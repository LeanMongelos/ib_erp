/**
 * Validación compartida UI ↔ API para moneda/cotización en documentos.
 * Client-safe (sin Prisma).
 */

export const MENSAJE_COTIZACION_USD_FALTANTE =
  'La cotización USD es obligatoria para documentos en dólares. Configurala en Contabilidad o ingresala manualmente.'

export function validarMonedaDocumentoCliente(
  moneda: string,
  cotizacionUsd: number | null | undefined,
): string | null {
  if (moneda !== 'USD') return null
  if (cotizacionUsd != null && cotizacionUsd > 0) return null
  return MENSAJE_COTIZACION_USD_FALTANTE
}
