/** Utilidades de período y vencimiento para cuotas de alquiler. */

export function formatPeriodo(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function calcularVencimientoCuota(fechaReferencia: Date, diaFacturacion: number): Date {
  const dia = Math.min(Math.max(diaFacturacion, 1), 28)
  const venc = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), dia, 12, 0, 0, 0)
  if (venc.getTime() < fechaReferencia.getTime()) {
    venc.setMonth(venc.getMonth() + 1)
  }
  return venc
}

export const ESTADO_CONTRATO_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador',
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

export const ESTADO_CUOTA_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  FACTURADA: 'Facturada',
  COBRADA: 'Cobrada',
  VENCIDA: 'Vencida',
  ANULADA: 'Anulada',
}

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Convierte "2026-03" → "marzo 2026" */
export function formatPeriodoLegible(periodo: string): string {
  const [y, m] = periodo.split('-')
  const idx = parseInt(m ?? '1', 10) - 1
  if (idx < 0 || idx > 11 || !y) return periodo
  return `${MESES_ES[idx]} ${y}`
}

/** "Formosa, 29 de junio de 2026" */
export function formatFechaActaLugar(fecha: Date, lugar = 'Formosa'): string {
  const dia = fecha.getDate()
  const mes = MESES_ES[fecha.getMonth()]
  const anio = fecha.getFullYear()
  return `${lugar}, ${dia} de ${mes} de ${anio}`
}
