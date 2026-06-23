/** Comprueba que un buffer parezca un PDF completo (no HTML de error ni salida truncada). */
export function isValidPdfBuffer(buf: Buffer): boolean {
  if (buf.length < 100) return false
  if (!buf.subarray(0, 5).toString('ascii').startsWith('%PDF-')) return false
  const tail = buf.subarray(Math.max(0, buf.length - 2048)).toString('ascii')
  return tail.includes('%%EOF')
}

/** Validación en cliente (ArrayBuffer / Blob). */
export async function validarPdfBlob(blob: Blob): Promise<void> {
  if (blob.size < 100) throw new Error('PDF vacío')
  const buf = await blob.arrayBuffer()
  const u8 = new Uint8Array(buf)
  const sig = String.fromCharCode(...u8.slice(0, 5))
  if (!sig.startsWith('%PDF-')) throw new Error('Archivo PDF inválido')
  const tailStart = Math.max(0, u8.length - 2048)
  const tail = String.fromCharCode(...u8.slice(tailStart))
  if (!tail.includes('%%EOF')) throw new Error('PDF incompleto o corrupto')
}
