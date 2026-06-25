/**
 * Lógica pura de vencimiento de planes preventivos (sin Prisma).
 */

export const ESTADOS_PLAN_SUJETOS_VENCIMIENTO = ['PROGRAMADO', 'PENDIENTE'] as const

export type EstadoPlanSujetoVencimiento = (typeof ESTADOS_PLAN_SUJETOS_VENCIMIENTO)[number]

/** Indica si un plan debe pasar a VENCIDO según estado y próximo servicio. */
export function planDebeMarcarseVencido(
  estado: string,
  proximoServicio: Date | null | undefined,
  hoy: Date,
): boolean {
  if (!proximoServicio) return false
  return (
    (ESTADOS_PLAN_SUJETOS_VENCIMIENTO as readonly string[]).includes(estado) &&
    proximoServicio.getTime() < inicioDia(hoy).getTime()
  )
}

function inicioDia(fecha: Date): Date {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Criterio Prisma para updateMany (equivalente a la regla pura). */
export function criterioPlanesMantenimientoVencidos(hoy: Date = new Date()) {
  const inicio = inicioDia(hoy)
  return {
    estado: { in: [...ESTADOS_PLAN_SUJETOS_VENCIMIENTO] },
    proximoServicio: { lt: inicio },
  }
}
