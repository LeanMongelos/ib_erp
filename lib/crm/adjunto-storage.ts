/** Helpers para adjuntos CRM (storage local / S3). Server-only. */

import { randomUUID } from 'crypto'

const ADJUNTO_PREFIX = 'crm/adjuntos/'

export function crmAdjuntoMediaUrl(storageKey: string): string {
  return `/api/crm/media/${storageKey.split('/').map(encodeURIComponent).join('/')}`
}

export function storageKeyFromCrmAdjuntoUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (!trimmed.startsWith('/api/crm/media/')) return null
  const encoded = trimmed.slice('/api/crm/media/'.length)
  try {
    const key = encoded.split('/').map(decodeURIComponent).join('/')
    if (!key.startsWith(ADJUNTO_PREFIX) || key.includes('..')) return null
    return key
  } catch {
    return null
  }
}

export function crmAdjuntoKeyForConversacion(conversacionId: string, ext: string): string {
  return `${ADJUNTO_PREFIX}${conversacionId}/${randomUUID()}.${ext}`
}

export const CRM_ADJUNTO_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

export const CRM_ADJUNTO_MAX_BYTES = 5 * 1024 * 1024
