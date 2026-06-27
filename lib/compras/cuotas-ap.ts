export interface CuotaPagoInput {
  numeroCuota: number
  fecha: Date
  monto: number
}

export function sumaCuotas(cuotas: Pick<CuotaPagoInput, 'monto'>[]): number {
  return Math.round(cuotas.reduce((a, c) => a + c.monto, 0) * 100) / 100
}

/** Valida que la suma de cuotas coincida con el total de la FC (±0.01). */
export function validarSumaCuotas(cuotas: Pick<CuotaPagoInput, 'monto'>[], total: number): boolean {
  if (cuotas.length === 0) return false
  return Math.abs(sumaCuotas(cuotas) - total) <= 0.01
}

export function cuotaUnicaDefault(fecha: Date, total: number): CuotaPagoInput[] {
  return [{ numeroCuota: 1, fecha, monto: total }]
}

export function plantillaCuotas30Dias(fechaBase: Date, total: number): CuotaPagoInput[] {
  const d = new Date(fechaBase)
  d.setDate(d.getDate() + 30)
  return [{ numeroCuota: 1, fecha: d, monto: total }]
}

export function plantillaCuotas306090(fechaBase: Date, total: number): CuotaPagoInput[] {
  const tercio = Math.round((total / 3) * 100) / 100
  const resto = Math.round((total - tercio * 2) * 100) / 100
  const mk = (dias: number, n: number, monto: number) => {
    const d = new Date(fechaBase)
    d.setDate(d.getDate() + dias)
    return { numeroCuota: n, fecha: d, monto }
  }
  return [mk(30, 1, tercio), mk(60, 2, tercio), mk(90, 3, resto)]
}
