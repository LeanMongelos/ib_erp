/**
 * Compresión de imágenes en el navegador antes de subir (reduce carga al servidor).
 * Redimensiona a máx. 800 px y exporta WebP (~80 % calidad).
 */

export type ComprimirImagenOpciones = {
  maxLado?: number
  calidad?: number
  maxBytes?: number
}

const DEFAULTS: Required<ComprimirImagenOpciones> = {
  maxLado: 800,
  calidad: 0.82,
  maxBytes: 380 * 1024,
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality)
  })
}

export async function comprimirImagenProducto(
  file: File,
  opts?: ComprimirImagenOpciones,
): Promise<File> {
  const { maxLado, calidad, maxBytes } = { ...DEFAULTS, ...opts }

  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen')
  }
  if (file.size <= maxBytes && file.type === 'image/webp') {
    return file
  }

  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * ratio))
  const h = Math.max(1, Math.round(bitmap.height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  let q = calidad
  let blob: Blob | null = null
  for (let i = 0; i < 6; i++) {
    blob = await canvasToBlob(canvas, 'image/webp', q)
    if (!blob) throw new Error('No se pudo comprimir la imagen')
    if (blob.size <= maxBytes) break
    q -= 0.12
    if (q < 0.45) break
  }

  if (!blob) throw new Error('No se pudo comprimir la imagen')

  const base = file.name.replace(/\.[^.]+$/, '') || 'producto'
  return new File([blob], `${base}.webp`, { type: 'image/webp' })
}
