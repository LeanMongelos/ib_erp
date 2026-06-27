import { prisma } from '@/lib/prisma'
import type { TipoMovimientoTesoreria } from '@prisma/client'

/** Monto con signo para cálculo de saldo. EGRESO resta; AJUSTE usa monto con signo almacenado. */
export function montoConSigno(tipo: TipoMovimientoTesoreria, monto: number): number {
  if (tipo === 'EGRESO') return -monto
  if (tipo === 'AJUSTE') return monto
  return monto
}

export async function calcularSaldo(cuentaId: string, hastaFecha?: Date): Promise<number> {
  const movimientos = await prisma.movimientoTesoreria.findMany({
    where: {
      cuentaTesoreriaId: cuentaId,
      anuladoEn: null,
      ...(hastaFecha ? { fecha: { lte: hastaFecha } } : {}),
    },
    select: { tipo: true, monto: true },
  })

  return movimientos.reduce((sum, m) => sum + montoConSigno(m.tipo, Number(m.monto)), 0)
}
