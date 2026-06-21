/** Sugiere alícuota según condición IVA del cliente (Argentina). */

const CONDICION_A_PORCENTAJE: Record<string, number> = {
  exento: 0,
  'consumidor final': 21,
  monotributo: 21,
  'responsable inscripto': 21,
  'responsable no inscripto': 21,
}

export function sugerirPorcentajeIva(condicionIva?: string | null, fallback = 21): number {
  if (!condicionIva?.trim()) return fallback
  const key = condicionIva.trim().toLowerCase()
  if (key in CONDICION_A_PORCENTAJE) return CONDICION_A_PORCENTAJE[key]
  if (key.includes('exento')) return 0
  if (key.includes('10,5') || key.includes('10.5')) return 10.5
  if (key.includes('27')) return 27
  return fallback
}

export function resolverPorcentajeCliente(
  cliente: {
    alicuotaIva?: { porcentaje: number } | null
    condicionIva?: string | null
  } | null | undefined,
  fallbackPct: number,
): number {
  if (cliente?.alicuotaIva?.porcentaje != null) return cliente.alicuotaIva.porcentaje
  return sugerirPorcentajeIva(cliente?.condicionIva, fallbackPct)
}
