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
