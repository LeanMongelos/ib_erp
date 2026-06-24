/**
 * Lógica pura de vencimiento de presupuestos (sin Prisma).
 * Compartida por actualizar-vencidos, tests e integridad.
 */

export const ESTADOS_PRESUPUESTO_SUJETOS_VENCIMIENTO = ['ENVIADO', 'APROBADO'] as const

export type EstadoPresupuestoSujetoVencimiento =
  (typeof ESTADOS_PRESUPUESTO_SUJETOS_VENCIMIENTO)[number]

/** Indica si un presupuesto debe pasar a VENCIDO según estado y fecha. */
export function presupuestoDebeMarcarseVencido(
  estado: string,
  fechaVencimiento: Date,
  ahora: Date,
): boolean {
  return (
    (ESTADOS_PRESUPUESTO_SUJETOS_VENCIMIENTO as readonly string[]).includes(estado) &&
    fechaVencimiento.getTime() < ahora.getTime()
  )
}

/** Criterio Prisma para updateMany (equivalente a la regla pura). */
export function criterioPresupuestosVencidos(ahora: Date = new Date()) {
  return {
    estado: { in: [...ESTADOS_PRESUPUESTO_SUJETOS_VENCIMIENTO] },
    fechaVencimiento: { lt: ahora },
  }
}
