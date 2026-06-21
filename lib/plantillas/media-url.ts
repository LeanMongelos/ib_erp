/** Helpers de URL para imágenes de plantillas (seguro en cliente). */

export function esImagenStorage(content?: string): boolean {
  return Boolean(content?.startsWith('storage:'))
}

export function previewUrlImagen(content?: string): string | null {
  if (!content?.startsWith('storage:')) return null
  const key = content.slice('storage:'.length)
  return `/api/plantillas/media/${key.split('/').map(encodeURIComponent).join('/')}`
}

export function urlPreviewImagen(content?: string): string {
  return previewUrlImagen(content) ?? content ?? '/logo.png'
}
