import { prisma } from '@/lib/prisma'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'
import { ingestarMensajeEntrante } from '@/lib/crm/ingest'

const GRAPH = 'https://graph.microsoft.com/v1.0'

export type EmailGraphConfig = {
  tenantId?: string
  clientId?: string
  clientSecret?: string
  mailboxEmail?: string
  refreshToken?: string
  accessToken?: string
  accessTokenExpires?: number
  lastGraphSync?: string
  processedMessageIds?: string[]
}

function cfg(config: unknown): EmailGraphConfig {
  return decryptCanalConfig(config) as EmailGraphConfig
}

async function persistConfig(canalId: string, prev: unknown, patch: Partial<EmailGraphConfig>) {
  const current = cfg(prev)
  const { encryptConfig } = await import('@/lib/integraciones/crypto')
  const merged = encryptConfig({ ...current, ...patch } as Record<string, unknown>)
  await prisma.canalIntegracion.update({
    where: { id: canalId },
    data: { config: merged as object },
  })
}

export async function exchangeGraphCode(
  config: unknown,
  code: string,
  redirectUri: string,
): Promise<{ ok: true; access_token: string; refresh_token?: string; expires_in: number } | { ok: false; error: string }> {
  const c = cfg(config)
  if (!c.tenantId || !c.clientId || !c.clientSecret) {
    return { ok: false, error: 'Faltan tenantId, clientId o clientSecret' }
  }

  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: 'offline_access Mail.Read Mail.Send User.Read',
  })

  const res = await fetch(
    `https://login.microsoftonline.com/${c.tenantId}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (data as { error_description?: string })?.error_description
    return { ok: false, error: err ?? 'Error de autenticación con Microsoft' }
  }

  const tokens = data as { access_token: string; refresh_token?: string; expires_in: number }
  return { ok: true, ...tokens }
}

export async function saveGraphTokens(canalId: string, config: unknown, tokens: {
  access_token: string
  refresh_token?: string
  expires_in: number
}) {
  await persistConfig(canalId, config, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? cfg(config).refreshToken,
    accessTokenExpires: Date.now() + tokens.expires_in * 1000,
  })
}

export async function getGraphAccessToken(canalId: string, config: unknown): Promise<string> {
  const c = cfg(config)
  if (c.accessToken && c.accessTokenExpires && c.accessTokenExpires > Date.now() + 60_000) {
    return c.accessToken
  }
  if (!c.refreshToken || !c.tenantId || !c.clientId || !c.clientSecret) {
    throw new Error('OAuth Graph no conectado — autorizá el buzón primero')
  }

  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: c.refreshToken,
    grant_type: 'refresh_token',
    scope: 'offline_access Mail.Read Mail.Send User.Read',
  })

  const res = await fetch(
    `https://login.microsoftonline.com/${c.tenantId}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (data as { error_description?: string })?.error_description
    throw new Error(err ?? 'Error al refrescar token Graph')
  }

  const tokens = data as { access_token: string; refresh_token?: string; expires_in: number }
  await saveGraphTokens(canalId, config, tokens)
  return tokens.access_token
}

export async function testGraphConnection(config: unknown): Promise<{ ok: boolean; error?: string }> {
  const c = cfg(config)
  if (!c.tenantId || !c.clientId || !c.clientSecret || !c.mailboxEmail) {
    return { ok: false, error: 'Completá tenantId, clientId, clientSecret y mailboxEmail' }
  }
  if (!c.refreshToken) {
    return { ok: false, error: 'Conectá OAuth con Microsoft antes de probar' }
  }

  const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_GRAPH' } })
  if (!canal) return { ok: false, error: 'Canal no encontrado' }

  try {
    const token = await getGraphAccessToken(canal.id, config)
    const res = await fetch(`${GRAPH}/users/${encodeURIComponent(c.mailboxEmail)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const err = (data as { error?: { message?: string } })?.error?.message
      return { ok: false, error: err ?? res.statusText }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de conexión con Microsoft Graph' }
  }
}

export async function pollGraphInbox(): Promise<number> {
  const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_GRAPH' } })
  if (!canal?.activo || canal.estado !== 'CONECTADO') return 0

  const c = cfg(canal.config)
  if (!c.mailboxEmail || !c.refreshToken) return 0

  let processed = 0
  const seen = new Set(c.processedMessageIds ?? [])

  try {
    const token = await getGraphAccessToken(canal.id, canal.config)
    const since = c.lastGraphSync ?? new Date(Date.now() - 7 * 86400000).toISOString()
    const url = `${GRAPH}/users/${encodeURIComponent(c.mailboxEmail)}/messages?$filter=receivedDateTime ge '${since}'&$top=25&$orderby=receivedDateTime asc&$select=id,conversationId,subject,bodyPreview,from,internetMessageId`

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Graph mail: ${res.statusText}`)

    const data = await res.json() as { value?: Array<{
      id: string
      conversationId?: string
      subject?: string
      bodyPreview?: string
      internetMessageId?: string
      from?: { emailAddress?: { name?: string; address?: string } }
    }> }

    let lastSync = c.lastGraphSync
    const newIds = [...seen]

    for (const msg of data.value ?? []) {
      if (seen.has(msg.id)) continue
      const from = msg.from?.emailAddress
      if (!from?.address) continue

      const externalId = msg.conversationId ?? msg.internetMessageId ?? msg.id
      const contenido = `Asunto: ${msg.subject ?? '(sin asunto)'}\n\n${msg.bodyPreview ?? ''}`

      await ingestarMensajeEntrante({
        tipoCanal: 'EMAIL_GRAPH',
        externalId,
        contactoNombre: from.name ?? from.address.split('@')[0],
        contactoHandle: from.address,
        contenido,
        externalMsgId: msg.id,
        emailRemitente: from.address,
        tipo: 'EMAIL',
      })

      newIds.push(msg.id)
      if (newIds.length > 500) newIds.splice(0, newIds.length - 500)
      lastSync = new Date().toISOString()
      processed += 1
    }

    await persistConfig(canal.id, canal.config, {
      lastGraphSync: lastSync,
      processedMessageIds: newIds,
    })

    if (processed > 0) {
      await prisma.canalIntegracion.update({
        where: { id: canal.id },
        data: { ultimoSync: new Date(), errorMensaje: null },
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de conexión con Microsoft Graph'
    await prisma.canalIntegracion.update({
      where: { tipo: 'EMAIL_GRAPH' },
      data: { estado: 'ERROR', errorMensaje: msg },
    })
    throw err
  }

  return processed
}

export async function sendGraphEmail(config: unknown, canalId: string, to: string, subject: string, text: string) {
  const c = cfg(config)
  if (!c.mailboxEmail) return { ok: false, error: 'mailboxEmail no configurado' }

  try {
    const token = await getGraphAccessToken(canalId, config)
    const res = await fetch(`${GRAPH}/users/${encodeURIComponent(c.mailboxEmail)}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
          body: { contentType: 'Text', content: text },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const err = (data as { error?: { message?: string } })?.error?.message
      return { ok: false, error: err ?? res.statusText }
    }
    return { ok: true, externalMsgId: `graph-${Date.now()}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error envío Graph' }
  }
}

export function buildGraphAuthorizeUrl(config: unknown, redirectUri: string, state: string): string {
  const c = cfg(config)
  if (!c.tenantId || !c.clientId) throw new Error('tenantId y clientId requeridos')
  const params = new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'offline_access Mail.Read Mail.Send User.Read',
    state,
  })
  return `https://login.microsoftonline.com/${c.tenantId}/oauth2/v2.0/authorize?${params}`
}
