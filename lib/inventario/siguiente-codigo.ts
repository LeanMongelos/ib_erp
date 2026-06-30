/**
 * Correlativo de código interno (prefijo letras + número).
 */
import { prisma } from '@/lib/prisma'
import { normalizarCodigoInterno, validarCodigoInterno } from '@/lib/inventario/codigo-interno'

const RE_PREFIJO = /^([A-Z]{3,4})$/
const RE_COMPLETO = /^([A-Z]{3,4})([0-9]{3,4})$/

export function extraerPrefijoCodigo(raw: string): string | null {
  const n = normalizarCodigoInterno(raw)
  const m = n.match(/^([A-Z]{3,4})/)
  if (!m) return null
  const prefijo = m[1]!
  if (!RE_PREFIJO.test(prefijo)) return null
  return prefijo
}

export function parseCodigoInternoPartes(
  codigo: string,
): { prefijo: string; numero: number; digitos: number; codigo: string } | null {
  const normalizado = normalizarCodigoInterno(codigo)
  const validado = validarCodigoInterno(normalizado)
  if (!validado.ok) return null
  const m = validado.codigo.match(RE_COMPLETO)
  if (!m) return null
  return {
    prefijo: m[1]!,
    numero: parseInt(m[2]!, 10),
    digitos: m[2]!.length,
    codigo: validado.codigo,
  }
}

export function formatearCodigoCorrelativo(prefijo: string, numero: number, digitosPreferidos = 3): string {
  const p = prefijo.toUpperCase()
  const digitos = numero > 999 ? 4 : digitosPreferidos
  return `${p}${String(numero).padStart(digitos, '0')}`
}

export function incrementarCodigoInterno(
  raw: string,
): { ok: true; codigo: string } | { ok: false; error: string } {
  const partes = parseCodigoInternoPartes(raw)
  if (partes) {
    const next = partes.numero + 1
    if (next > 9999) {
      return { ok: false, error: 'Se alcanzó el máximo correlativo (9999) para este prefijo' }
    }
    return { ok: true, codigo: formatearCodigoCorrelativo(partes.prefijo, next, partes.digitos) }
  }

  const prefijo = extraerPrefijoCodigo(raw)
  if (prefijo) {
    return { ok: true, codigo: formatearCodigoCorrelativo(prefijo, 1) }
  }

  return {
    ok: false,
    error: 'Ingresá un prefijo de 3–4 letras (ej. HOE) o un código completo (ej. HOE098)',
  }
}

export type SiguienteCodigoResult = {
  prefijo: string
  ultimo: string | null
  ultimoNumero: number
  siguiente: string
}

export async function buscarSiguienteCodigoInterno(prefijoRaw: string): Promise<SiguienteCodigoResult> {
  const prefijo = extraerPrefijoCodigo(prefijoRaw)
  if (!prefijo) {
    throw new Error('El prefijo debe tener 3–4 letras (ej. HOE, ALQ)')
  }

  const candidatos = await prisma.inventario.findMany({
    where: {
      sku: { not: null, startsWith: prefijo, mode: 'insensitive' },
    },
    select: { sku: true },
  })

  let maxNum = 0
  let digitosMax = 3
  let ultimo: string | null = null

  for (const row of candidatos) {
    if (!row.sku) continue
    const partes = parseCodigoInternoPartes(row.sku)
    if (!partes || partes.prefijo !== prefijo) continue
    if (partes.numero > maxNum) {
      maxNum = partes.numero
      digitosMax = partes.digitos
      ultimo = partes.codigo
    }
  }

  const nextNum = maxNum + 1
  const siguiente = formatearCodigoCorrelativo(prefijo, nextNum, nextNum > 999 ? 4 : digitosMax)

  return { prefijo, ultimo, ultimoNumero: maxNum, siguiente }
}
