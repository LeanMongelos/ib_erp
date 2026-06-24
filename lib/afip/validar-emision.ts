/**
 * Validaciones pre-emisión AFIP (sin Prisma — usable en cliente y servidor).
 *
 * HOMOLOGACION: permite CAE simulado si faltan certificados (solo dev/demo).
 * PRODUCCION: exige certificado + clave privada antes de llegar a EMITIDA.
 */

export type EmisorAfipCampos = {
  ambiente: 'HOMOLOGACION' | 'PRODUCCION'
  certificadoPath?: string | null
  clavePrivadaPath?: string | null
}

export function esAmbienteProduccion(emisor: EmisorAfipCampos): boolean {
  return emisor.ambiente === 'PRODUCCION'
}

export function emisorTieneCertificados(emisor: EmisorAfipCampos): boolean {
  return Boolean(emisor.certificadoPath?.trim() && emisor.clavePrivadaPath?.trim())
}

/** `null` = OK; string = mensaje de error en español */
export function validarEmisionAfip(emisor: EmisorAfipCampos | null | undefined): string | null {
  if (!emisor) {
    return 'La factura no tiene emisor asignado'
  }
  if (esAmbienteProduccion(emisor) && !emisorTieneCertificados(emisor)) {
    return 'El emisor está en PRODUCCIÓN pero no tiene certificado AFIP ni clave privada cargados. Subí los archivos en Configuración → Emisores antes de emitir.'
  }
  return null
}
