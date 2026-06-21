/** Formato ARS estilo presupuesto IB: $102.102.000,00 */
export { formatImporteDocumento } from '@/lib/moneda'
import { formatImporteDocumento } from '@/lib/moneda'
import type { DatosDocumentoRender } from './types'

export function formatImporteAr(monto: number | string | null | undefined): string {
  return formatImporteDocumento(monto, 'ARS')
}

export function formatImporteDoc(
  monto: number | string | null | undefined,
  datos: Pick<DatosDocumentoRender, 'moneda'>,
): string {
  return formatImporteDocumento(monto, datos.moneda ?? 'ARS')
}

export function formatCantidadAr(cantidad: number): string {
  return cantidad.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
