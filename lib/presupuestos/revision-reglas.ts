/** Reglas de edición/revisión de presupuesto (client-safe, sin Prisma ni api-auth). */

export function presupuestoEditable(estado: string, tieneFactura: boolean): boolean {
  if (tieneFactura) return false
  return ['BORRADOR', 'ENVIADO'].includes(estado)
}

export function presupuestoPuedeRevisar(estado: string, tieneFactura: boolean): boolean {
  if (tieneFactura) return true
  return ['BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'CONVERTIDO'].includes(estado)
}
