import {
  calcularFechaVencimiento,
  repartirMontoCuotas,
} from '@/lib/cobranzas/plazos'

export interface CuotaConFinanciacion {
  numeroCuota: number
  dias: number
  fecha: Date
  montoBase: number
  interes: number
  monto: number
}

/** Interés total: cada cuota devenga tasa mensual prorrateada por días diferidos. */
export function calcularInteresFinanciacion(
  totalNeto: number,
  plazos: number[],
  tasaMensualPct: number,
): number {
  if (totalNeto <= 0 || plazos.length === 0 || tasaMensualPct <= 0) return 0

  const montosBase = repartirMontoCuotas(totalNeto, plazos.length)
  let interes = 0
  for (let i = 0; i < plazos.length; i++) {
    interes += montosBase[i] * (tasaMensualPct / 100) * (plazos[i] / 30)
  }
  return Math.round(interes * 100) / 100
}

export function previewVencimientosConFinanciacion(
  fechaEmision: Date,
  plazos: number[],
  totalNeto: number,
  tasaMensualPct: number,
): CuotaConFinanciacion[] {
  if (plazos.length === 0) return []

  const montosBase = repartirMontoCuotas(totalNeto, plazos.length)
  return plazos.map((dias, i) => {
    const montoBase = montosBase[i]
    const interes =
      tasaMensualPct > 0
        ? Math.round(montoBase * (tasaMensualPct / 100) * (dias / 30) * 100) / 100
        : 0
    return {
      numeroCuota: i + 1,
      dias,
      fecha: calcularFechaVencimiento(fechaEmision, dias),
      montoBase,
      interes,
      monto: Math.round((montoBase + interes) * 100) / 100,
    }
  })
}
