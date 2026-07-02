/** Rutas, URLs y validación de brochures (PDF) de producto. Reusa el media route de inventario. */

const PREFIX = 'inventario/'

export function inventarioBrochureMediaUrl(storageKey: string): string {
  return `/api/inventario/media/${storageKey.split('/').map(encodeURIComponent).join('/')}`
}

export function storageKeyFromInventarioBrochureUrl(url: string | null | undefined): string | null {
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

export function inventarioBrochureKey(inventarioId: string): string {
  return `${PREFIX}${inventarioId}/brochure-${Date.now()}.pdf`
}

export const INVENTARIO_BROCHURE_MIME = 'application/pdf'
/** Límite del brochure PDF: 20 MB. */
export const INVENTARIO_BROCHURE_MAX_BYTES = 20 * 1024 * 1024
