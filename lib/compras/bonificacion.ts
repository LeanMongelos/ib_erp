import { redondear2 } from '@/lib/utils'

/** Precio neto unitario post-bonificación. Si hay precio lista, aplica bonif %; si no, usa precioUnit fallback. */
export function calcularPrecioNeto(
  precioLista: number | null | undefined,
  bonificacionPct?: number,
  precioUnitFallback?: number,
): number {
  if (precioLista != null && precioLista > 0) {
    const bonif = bonificacionPct ?? 0
    return redondear2(precioLista * (1 - bonif / 100))
  }
  return redondear2(precioUnitFallback ?? 0)
}

export function calcularPrecioNetoItem(input: {
  precioUnit?: number
  precioLista?: number | null
  bonificacionPct?: number
}): number {
  return calcularPrecioNeto(input.precioLista, input.bonificacionPct, input.precioUnit)
}
