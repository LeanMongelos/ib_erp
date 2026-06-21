/** Utilidades de presentación IVA — seguras para cliente y servidor. */

export function formatAlicuotaLabel(porcentaje: number, nombre?: string): string {
  const pct = Number.isInteger(porcentaje) ? String(porcentaje) : porcentaje.toFixed(1).replace(/\.0$/, '')
  return nombre ? `${nombre} (${pct}%)` : `${pct}%`
}
