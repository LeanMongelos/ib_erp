/**
 * Totales de presupuesto — única fuente para POST y PATCH (invariante F1 / Pr2).
 */
import { calcularTotales, type ItemDocumentoInput } from '@/lib/documentos'
import { calcularInteresFinanciacion } from '@/lib/cobranzas/financiacion'
import { parsePlazosCobranza } from '@/lib/cobranzas/plazos'

export type PresupuestoTotalesInput = {
  items: ItemDocumentoInput[]
  bonificacionPct?: number
  alicuotaIvaPct?: number
  plazosCobranza?: number[]
  condicionPago?: string | null
  tasaFinanciacionPct?: number
  /** Si viene del cliente, la API lo recalcula solo si falta. */
  interesFinanciacion?: number
}

export function calcularTotalesPresupuesto(input: PresupuestoTotalesInput) {
  const { itemsCalculados, subtotal, iva, alicuotaIvaPct } = calcularTotales(
    input.items,
    input.bonificacionPct ?? 0,
    input.alicuotaIvaPct ?? 21,
  )

  const plazos = input.plazosCobranza?.length
    ? input.plazosCobranza
    : parsePlazosCobranza(input.condicionPago)

  const tasaFinanciacionPct = input.tasaFinanciacionPct ?? 0
  const interesFinanciacion =
    input.interesFinanciacion ??
    calcularInteresFinanciacion(subtotal + iva, plazos, tasaFinanciacionPct)

  const total = subtotal + iva + interesFinanciacion

  return {
    itemsCalculados,
    subtotal,
    iva,
    interesFinanciacion,
    total,
    alicuotaIvaPct,
    plazos,
  }
}
