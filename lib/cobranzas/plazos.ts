/** Presets y parseo de plazos de cobranza (días desde emisión). */

export const PRESETS_PLAZOS = {
  contado: [] as number[],
  '30': [30],
  '30-60-90': [30, 60, 90],
  '15-45-58': [15, 45, 58],
} as const

export type PresetPlazoKey = keyof typeof PRESETS_PLAZOS

export function parsePlazosCobranza(input: string | number[] | undefined | null): number[] {
  if (input == null) return []
  if (Array.isArray(input)) {
    return ordenarPlazosUnicos(input)
  }
  const str = String(input).trim()
  if (!str || /^contado$/i.test(str)) return []
  const nums = str.match(/\d+/g)?.map(Number) ?? []
  return ordenarPlazosUnicos(nums)
}

function ordenarPlazosUnicos(nums: number[]): number[] {
  return [...new Set(nums.filter((d) => Number.isFinite(d) && d > 0 && d <= 730))].sort(
    (a, b) => a - b,
  )
}

export function formatCondicionPago(plazos: number[]): string {
  if (plazos.length === 0) return 'Contado'
  if (plazos.length === 1) return `${plazos[0]} días`
  return `${plazos.join('-')} días`
}

export function calcularFechaVencimiento(fechaEmision: Date, diasDesdeEmision: number): Date {
  const d = new Date(fechaEmision)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + diasDesdeEmision)
  d.setHours(23, 59, 59, 999)
  return d
}

export function previewVencimientos(
  fechaEmision: Date,
  plazos: number[],
  total: number,
): Array<{ numeroCuota: number; dias: number; fecha: Date; monto: number }> {
  const montos = repartirMontoCuotas(total, plazos.length)
  return plazos.map((dias, i) => ({
    numeroCuota: i + 1,
    dias,
    fecha: calcularFechaVencimiento(fechaEmision, dias),
    monto: montos[i],
  }))
}

export function detectPresetFromPlazos(plazos: number[]): PresetPlazoKey | 'custom' | 'contado' {
  if (plazos.length === 0) return 'contado'
  for (const [key, preset] of Object.entries(PRESETS_PLAZOS) as [PresetPlazoKey, number[]][]) {
    if (key === 'contado') continue
    if (preset.length === plazos.length && preset.every((d, i) => d === plazos[i])) {
      return key
    }
  }
  return 'custom'
}

export function repartirMontoCuotas(total: number, cantidad: number): number[] {
  if (cantidad <= 0) return []
  const base = Math.floor((total / cantidad) * 100) / 100
  const montos = Array.from({ length: cantidad }, () => base)
  const sumParcial = base * (cantidad - 1)
  montos[cantidad - 1] = Math.round((total - sumParcial) * 100) / 100
  return montos
}
