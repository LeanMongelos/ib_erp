/** Adjuntos de tickets (JPEG/PNG). Server-only. */

import { randomUUID } from 'crypto'

const PREFIX = 'tickets/adjuntos/'

export function ticketAdjuntoMediaUrl(storageKey: string): string {
  return `/api/tickets/media/${storageKey.split('/').map(encodeURIComponent).join('/')}`
}

export function storageKeyFromTicketAdjuntoUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (!trimmed.startsWith('/api/tickets/media/')) return null
  const encoded = trimmed.slice('/api/tickets/media/'.length)
  try {
    const key = encoded.split('/').map(decodeURIComponent).join('/')
    if (!key.startsWith(PREFIX) || key.includes('..')) return null
    return key
  } catch {
    return null
  }
}

export function ticketAdjuntoKey(ticketId: string, ext: string): string {
  return `${PREFIX}${ticketId}/${randomUUID()}.${ext}`
}

export const TICKET_ADJUNTO_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
}

export const TICKET_ADJUNTO_MAX_BYTES = 5 * 1024 * 1024
