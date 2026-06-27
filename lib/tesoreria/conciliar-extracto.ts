import { differenceInCalendarDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import type { LineaExtracto } from '@/lib/tesoreria/parse-extracto-csv'
import { montoConSigno } from '@/lib/tesoreria/saldo'

export interface MatchExtracto {
  linea: LineaExtracto
  movimientoId: string | null
  movimientoDescripcion: string | null
  movimientoFecha: string | null
  movimientoMonto: number | null
  confianza: 'alta' | 'media' | 'baja' | 'ninguna'
}

const TOLERANCIA_MONTO = 0.01
const TOLERANCIA_DIAS = 2

function montoMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCIA_MONTO
}

export async function sugerirMatchesExtracto(
  cuentaId: string,
  lineas: LineaExtracto[],
): Promise<MatchExtracto[]> {
  const movimientos = await prisma.movimientoTesoreria.findMany({
    where: {
      cuentaTesoreriaId: cuentaId,
      conciliadoEn: null,
      anuladoEn: null,
      tipo: { not: 'SALDO_INICIAL' },
    },
    orderBy: { fecha: 'desc' },
    take: 500,
    select: { id: true, fecha: true, tipo: true, monto: true, descripcion: true },
  })

  const usados = new Set<string>()

  return lineas.map((linea) => {
    let mejor: (typeof movimientos)[0] | null = null
    let mejorDiff = Infinity

    for (const m of movimientos) {
      if (usados.has(m.id)) continue
      const signed = montoConSigno(m.tipo, Number(m.monto))
      if (!montoMatch(signed, linea.montoSigned)) continue
      const diff = Math.abs(differenceInCalendarDays(m.fecha, linea.fecha))
      if (diff > TOLERANCIA_DIAS) continue
      if (diff < mejorDiff) {
        mejorDiff = diff
        mejor = m
      }
    }

    if (mejor) usados.add(mejor.id)

    let confianza: MatchExtracto['confianza'] = 'ninguna'
    if (mejor) {
      confianza = mejorDiff === 0 ? 'alta' : mejorDiff <= 1 ? 'media' : 'baja'
    }

    return {
      linea,
      movimientoId: mejor?.id ?? null,
      movimientoDescripcion: mejor?.descripcion ?? null,
      movimientoFecha: mejor?.fecha.toISOString() ?? null,
      movimientoMonto: mejor ? montoConSigno(mejor.tipo, Number(mejor.monto)) : null,
      confianza,
    }
  })
}

export async function aplicarConciliacionExtracto(
  matches: { movimientoId: string; extractoRef: string }[],
  usuarioId: string,
) {
  const results = []
  for (const m of matches) {
    const mov = await prisma.movimientoTesoreria.update({
      where: { id: m.movimientoId },
      data: {
        conciliadoEn: new Date(),
        conciliadoPorId: usuarioId,
        extractoRef: m.extractoRef.slice(0, 120),
      },
    })
    results.push(mov)
  }
  return results
}
