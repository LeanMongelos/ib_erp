import { parseCanalConfig, type MetaPageConfig } from '@/lib/crm/config'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'
import { ingestarMensajeEntrante } from '@/lib/crm/ingest'
import type { TipoCanalIntegracion } from '@prisma/client'

const GRAPH = 'https://graph.facebook.com/v21.0'

export type MetaInbound = {
  senderId: string
  messageId: string
  text: string
  canal: 'FACEBOOK' | 'INSTAGRAM'
  isEcho: boolean
}

export function parseMetaWebhook(body: unknown): MetaInbound[] {
  const result: MetaInbound[] = []
  if (!body || typeof body !== 'object') return result
  const obj = body as Record<string, unknown>
  const objectType = obj.object as string
  if (objectType !== 'page' && objectType !== 'instagram') return result

  const canal: 'FACEBOOK' | 'INSTAGRAM' = objectType === 'instagram' ? 'INSTAGRAM' : 'FACEBOOK'

  for (const entry of (obj.entry as unknown[]) ?? []) {
    const e = entry as Record<string, unknown>
    for (const event of (e.messaging as unknown[]) ?? []) {
      const ev = event as Record<string, unknown>
      const message = ev.message as Record<string, unknown> | undefined
      if (!message?.mid) continue
      if (message.is_echo) continue

      const text =
        (message.text as string) ??
        (message.attachments ? '[adjunto]' : '')

      if (!text) continue

      const sender = ev.sender as Record<string, unknown>
      result.push({
        senderId: String(sender?.id ?? ''),
        messageId: String(message.mid),
        text,
        canal,
        isEcho: Boolean(message.is_echo),
      })
    }
  }
  return result
}

export async function procesarMetaWebhook(body: unknown) {
  const mensajes = parseMetaWebhook(body)
  const ingested = []
  for (const m of mensajes) {
    if (!m.senderId) continue
    const r = await ingestarMensajeEntrante({
      tipoCanal: m.canal,
      externalId: m.senderId,
      contactoNombre: m.canal === 'INSTAGRAM' ? 'Instagram' : 'Facebook',
      contactoHandle: m.senderId,
      contenido: m.text,
      externalMsgId: m.messageId,
    })
    ingested.push(r)
  }
  return ingested
}

export async function sendMetaMessage(
  tipo: TipoCanalIntegracion,
  config: unknown,
  recipientId: string,
  text: string,
) {
  const c = parseCanalConfig<MetaPageConfig>(decryptCanalConfig(config))
  if (!c.pageId || !c.pageAccessToken) {
    return { ok: false, error: 'Meta no configurado (pageId/pageAccessToken)' }
  }

  const res = await fetch(`${GRAPH}/${c.pageId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.pageAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (data as { error?: { message?: string } })?.error?.message
    return { ok: false, error: err ?? res.statusText }
  }
  const msgId = (data as { message_id?: string })?.message_id
  return { ok: true, externalMsgId: msgId }
}

export async function testMetaConnection(config: unknown): Promise<{ ok: boolean; error?: string }> {
  const c = parseCanalConfig<MetaPageConfig>(decryptCanalConfig(config))
  if (!c.pageId || !c.pageAccessToken) {
    return { ok: false, error: 'Faltan pageId o pageAccessToken' }
  }
  const res = await fetch(`${GRAPH}/${c.pageId}?fields=name,id`, {
    headers: { Authorization: `Bearer ${c.pageAccessToken}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = (data as { error?: { message?: string } })?.error?.message
    return { ok: false, error: err ?? res.statusText }
  }
  return { ok: true }
}
