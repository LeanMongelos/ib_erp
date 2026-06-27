import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { ApiError } from '@/lib/api-auth'

type Tx = Prisma.TransactionClient

export async function cargarSaldoInicial(
  cuentaId: string,
  fecha: Date,
  monto: number,
  usuarioId: string,
  tx?: Tx,
) {
  if (monto <= 0) throw new ApiError(400, 'El saldo inicial debe ser mayor a cero')
  if (Number.isNaN(fecha.getTime())) throw new ApiError(400, 'Fecha inválida')

  const db = tx ?? prisma

  const cuenta = await db.cuentaTesoreria.findUnique({ where: { id: cuentaId } })
  if (!cuenta) throw new ApiError(404, 'Cuenta de tesorería no encontrada')
  if (!cuenta.activa) throw new ApiError(400, 'La cuenta está inactiva')
  if (cuenta.saldoInicialCargado) {
    throw new ApiError(400, 'El saldo inicial ya fue cargado para esta cuenta')
  }

  const movimiento = await db.movimientoTesoreria.create({
    data: {
      cuentaTesoreriaId: cuentaId,
      fecha,
      tipo: 'SALDO_INICIAL',
      monto,
      descripcion: 'Saldo inicial',
      creadoPorId: usuarioId,
    },
  })

  await db.cuentaTesoreria.update({
    where: { id: cuentaId },
    data: { saldoInicialCargado: true },
  })

  return movimiento
}
