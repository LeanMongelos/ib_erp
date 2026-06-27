import { formatMonto } from '@/lib/utils'

export function simboloMoneda(moneda: string): string {
  if (moneda === 'USD') return 'USD'
  if (moneda === 'EUR') return 'EUR'
  return '$'
}

/** Formatea monto según moneda del documento (sin convertir tipos de cambio). */
export function formatMontoMoneda(monto: number | string | null | undefined, moneda = 'ARS'): string {
  const valor = Number(monto ?? 0)
  if (!Number.isFinite(valor)) return moneda === 'USD' ? 'USD 0' : formatMonto(0)
  if (moneda === 'USD') {
    return `USD ${valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  if (moneda === 'EUR') {
    return `EUR ${valor.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return formatMonto(valor)
}

export function validarMonedaFcVsOc(
  fcMoneda: string,
  ocMoneda: string | undefined | null,
  notaMonedaOc?: string | null,
): string | null {
  if (!ocMoneda || fcMoneda === ocMoneda) return null
  if (notaMonedaOc?.trim()) return null
  return 'La moneda de la factura difiere de la orden de compra; indicá una nota explicativa'
}

/** Todas las imputaciones deben ser de facturas en la misma moneda. */
export function validarMonedaUnicaImputaciones(
  monedasFacturas: string[],
  monedaPago?: string,
): string | null {
  const unicas = [...new Set(monedasFacturas.filter(Boolean))]
  if (unicas.length === 0) return null
  if (unicas.length > 1) {
    return 'No se pueden imputar vencimientos en distintas monedas en un mismo pago'
  }
  if (monedaPago && monedaPago !== unicas[0]) {
    return `La moneda del pago (${monedaPago}) debe coincidir con la de las facturas (${unicas[0]})`
  }
  return null
}

export type SaldoPorMoneda = Record<string, number>

export function acumularSaldoPorMoneda(acum: SaldoPorMoneda, moneda: string, delta: number): SaldoPorMoneda {
  const m = moneda || 'ARS'
  return { ...acum, [m]: (acum[m] ?? 0) + delta }
}
