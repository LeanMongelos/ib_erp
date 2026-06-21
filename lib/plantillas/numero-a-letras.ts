/**
 * Convierte un importe ARS a texto (es-AR simplificado).
 */

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const DECENAS = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const ESPECIALES: Record<number, string> = {
  10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
  16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve',
  21: 'veintiuno', 22: 'veintidós', 23: 'veintitrés', 24: 'veinticuatro',
  25: 'veinticinco', 26: 'veintiséis', 27: 'veintisiete', 28: 'veintiocho', 29: 'veintinueve',
}

function centenas(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const cent = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
    'seiscientos', 'setecientos', 'ochocientos', 'novecientos'][c]
  return `${cent} ${decenas(resto)}`.trim()
}

function decenas(n: number): string {
  if (n === 0) return ''
  if (ESPECIALES[n]) return ESPECIALES[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  if (d === 0) return UNIDADES[u]
  if (u === 0) return DECENAS[d]
  return `${DECENAS[d]} y ${UNIDADES[u]}`
}

function miles(n: number): string {
  if (n < 1000) return centenas(n)
  const m = Math.floor(n / 1000)
  const resto = n % 1000
  const pref = m === 1 ? 'mil' : `${centenas(m)} mil`
  return `${pref} ${centenas(resto)}`.trim()
}

function millones(n: number): string {
  if (n < 1_000_000) return miles(n)
  const m = Math.floor(n / 1_000_000)
  const resto = n % 1_000_000
  const pref = m === 1 ? 'un millón' : `${miles(m)} millones`
  return `${pref} ${miles(resto)}`.trim()
}

export function numeroALetras(monto: number): string {
  const entero = Math.floor(monto)
  const centavos = Math.round((monto - entero) * 100)
  const texto = millones(entero)
  const centStr = String(centavos).padStart(2, '0')
  return `Son pesos ${texto} con ${centStr}/100`
}
