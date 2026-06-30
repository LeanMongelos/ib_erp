/**
 * Consulta BD para el siguiente código interno (solo servidor).
 */
import { prisma } from '@/lib/prisma'
import {
  extraerPrefijoCodigo,
  formatearCodigoCorrelativo,
  parseCodigoInternoPartes,
  type SiguienteCodigoResult,
} from '@/lib/inventario/siguiente-codigo'

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
