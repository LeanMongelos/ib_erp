import { parseCanalConfig, type WhatsAppConfig } from '@/lib/crm/config'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'
import { ingestarMensajeEntrante } from '@/lib/crm/ingest'

const GRAPH = 'https://graph.facebook.com/v21.0'

export type WhatsAppInbound = {
  from: string
  messageId: string
  text: string
  contactName: string
}

export function parseWhatsAppWebhook(body: unknown): WhatsAppInbound[] {
  const result: WhatsAppInbound[] = []
  if (!body || typeof body !== 'object') return result
  const obj = body as Record<string, unknown>
  if (obj.object !== 'whatsapp_business_account') return result

  for (const entry of (obj.entry as unknown[]) ?? []) {
    const e = entry as Record<string, unknown>
    for (const change of (e.changes as unknown[]) ?? []) {
      const c = change as Record<string, unknown>
      const value = c.value as Record<string, unknown> | undefined
      if (!value?.messages) continue
      const contacts = (value.contacts as Record<string, unknown>[]) ?? []
      const profile = (contacts[0]?.profile as Record<string, unknown>) ?? {}
      const name = (profile.name as string) ?? 'WhatsApp'

      for (const msg of (value.messages as unknown[]) ?? []) {
        const m = msg as Record<string, unknown>
        const type = m.type as string
        let text = ''
        if (type === 'text') {
          text = ((m.text as Record<string, unknown>)?.body as string) ?? ''
        } else {
          text = `[${type}]`
        }
        if (!text) continue
        result.push({
          from: String(m.from),
          messageId: String(m.id),
          text,
          contactName: name,
        })
      }
    }
  }
  return result
}

export async function procesarWhatsAppWebhook(body: unknown) {
  const mensajes = parseWhatsAppWebhook(body)
  const ingested = []
  for (const m of mensajes) {
    const r = await ingestarMensajeEntrante({
      tipoCanal: 'WHATSAPP',
      externalId: m.from,
      contactoNombre: m.contactName,
      contactoHandle: `+${m.from}`,
      contenido: m.text,
      externalMsgId: m.messageId,
    })
    ingested.push(r)
  }
  return ingested
}

export async function sendWhatsAppMessage(config: unknown, to: string, text: string) {
  const c = parseCanalConfig<WhatsAppConfig>(decryptCanalConfig(config))
  if (!c.phoneNumberId || !c.accessToken) {
    return { ok: false, error: 'WhatsApp no configurado (phoneNumberId/accessToken)' }
  }

  const res = await fetch(`${GRAPH}/${c.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: text },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (data as Record<string, unknown>)?.error
    const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message: string }).message) : res.statusText
    return { ok: false, error: msg }
  }
  const msgId = (data as Record<string, unknown>)?.messages
    ? ((data as { messages: { id: string }[] }).messages[0]?.id)
    : undefined
  return { ok: true, externalMsgId: msgId }
}

export async function testWhatsAppConnection(config: unknown): Promise<{ ok: boolean; error?: string }> {
  const c = parseCanalConfig<WhatsAppConfig>(decryptCanalConfig(config))
  if (!c.phoneNumberId || !c.accessToken) {
    return { ok: false, error: 'Faltan phoneNumberId o accessToken' }
  }
  const res = await fetch(`${GRAPH}/${c.phoneNumberId}`, {
    headers: { Authorization: `Bearer ${c.accessToken}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = (data as { error?: { message?: string } })?.error?.message
    return { ok: false, error: err ?? res.statusText }
  }
  return { ok: true }
}
