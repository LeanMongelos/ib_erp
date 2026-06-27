import { prisma } from '@/lib/prisma'
import type { MedioPago, Prisma, TipoCuentaTesoreria } from '@prisma/client'
import { ApiError } from '@/lib/api-auth'

type Tx = Prisma.TransactionClient

const TIPO_POR_MEDIO: Partial<Record<MedioPago, TipoCuentaTesoreria>> = {
  EFECTIVO: 'CAJA',
  TRANSFERENCIA: 'BANCO',
  TARJETA: 'BANCO',
  OTRO: 'BANCO',
}

export function tipoCuentaParaMedio(medio: MedioPago): TipoCuentaTesoreria | null {
  return TIPO_POR_MEDIO[medio] ?? null
}

export async function resolverCuentaTesoreriaParaPago(
  medio: MedioPago,
  cuentaTesoreriaId?: string | null,
  tx?: Tx,
) {
  const db = tx ?? prisma

  if (cuentaTesoreriaId) {
    const cuenta = await db.cuentaTesoreria.findFirst({
      where: { id: cuentaTesoreriaId, activa: true },
    })
    if (!cuenta) throw new ApiError(400, 'Cuenta de tesorería no encontrada o inactiva')
    return cuenta
  }

  const tipo = medio === 'CHEQUE' ? 'BANCO' : tipoCuentaParaMedio(medio)
  if (!tipo) {
    throw new ApiError(400, 'Este medio de pago no genera movimiento en tesorería')
  }

  const cuenta =
    (await db.cuentaTesoreria.findFirst({
      where: { activa: true, tipo, predeterminada: true },
      orderBy: { creadoEn: 'asc' },
    })) ??
    (await db.cuentaTesoreria.findFirst({
      where: { activa: true, tipo },
      orderBy: { creadoEn: 'asc' },
    }))

  if (!cuenta) {
    const label = tipo === 'CAJA' ? 'caja' : 'banco'
    throw new ApiError(400, `No hay cuenta de tesorería activa para ${label}`)
  }

  return cuenta
}
