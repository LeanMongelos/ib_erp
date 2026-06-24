/** Rutas y URLs de fotos de producto (storage local / S3). */

const PREFIX = 'inventario/'

export function inventarioFotoMediaUrl(storageKey: string): string {
  return `/api/inventario/media/${storageKey.split('/').map(encodeURIComponent).join('/')}`
}

export function storageKeyFromInventarioFotoUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (!trimmed.startsWith('/api/inventario/media/')) return null
  const encoded = trimmed.slice('/api/inventario/media/'.length)
  try {
    const key = encoded.split('/').map(decodeURIComponent).join('/')
    if (!key.startsWith(PREFIX) || key.includes('..')) return null
    return key
  } catch {
    return null
  }
}

export function inventarioFotoKey(inventarioId: string, ext: string): string {
  return `${PREFIX}${inventarioId}/${Date.now()}.${ext}`
}

export const INVENTARIO_FOTO_MIME_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
}

/** Tras comprimir en el cliente, el servidor acepta hasta 600 KB. */
export const INVENTARIO_FOTO_MAX_BYTES = 600 * 1024
