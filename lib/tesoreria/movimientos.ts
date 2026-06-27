import { prisma } from '@/lib/prisma'
import type { Prisma, TipoMovimientoTesoreria } from '@prisma/client'
import { ApiError } from '@/lib/api-auth'
import { calcularSaldo } from '@/lib/tesoreria/saldo'

type Tx = Prisma.TransactionClient

const TIPOS_MANUALES: TipoMovimientoTesoreria[] = ['INGRESO', 'EGRESO', 'AJUSTE']

export async function crearMovimientoManual(
  data: {
    cuentaTesoreriaId: string
    fecha: Date
    tipo: TipoMovimientoTesoreria
    monto: number
    descripcion: string
    referencia?: string | null
    usuarioId: string
  },
  tx?: Tx,
) {
  if (!TIPOS_MANUALES.includes(data.tipo)) {
    throw new ApiError(400, 'Tipo de movimiento no permitido para registro manual')
  }

  const db = tx ?? prisma

  const cuenta = await db.cuentaTesoreria.findUnique({ where: { id: data.cuentaTesoreriaId } })
  if (!cuenta) throw new ApiError(404, 'Cuenta de tesorería no encontrada')
  if (!cuenta.activa) throw new ApiError(400, 'La cuenta está inactiva')

  if (Number.isNaN(data.fecha.getTime())) throw new ApiError(400, 'Fecha inválida')

  let monto = data.monto
  if (data.tipo === 'AJUSTE') {
    if (monto === 0) throw new ApiError(400, 'El ajuste no puede ser cero')
  } else if (monto <= 0) {
    throw new ApiError(400, 'El monto debe ser mayor a cero')
  }

  if (data.tipo === 'EGRESO') {
    const saldo = await calcularSaldo(data.cuentaTesoreriaId)
    if (saldo - monto < -0.01) {
      throw new ApiError(400, 'Saldo insuficiente para registrar el egreso')
    }
  }

  return db.movimientoTesoreria.create({
    data: {
      cuentaTesoreriaId: data.cuentaTesoreriaId,
      fecha: data.fecha,
      tipo: data.tipo,
      monto: data.tipo === 'AJUSTE' ? monto : Math.abs(monto),
      descripcion: data.descripcion.trim(),
      referencia: data.referencia?.trim() || null,
      creadoPorId: data.usuarioId,
    },
    include: {
      cuentaTesoreria: { select: { id: true, nombre: true, tipo: true } },
      creadoPor: { select: { id: true, nombre: true } },
    },
  })
}

export async function anularMovimientoPorPago(pagoId: string, tx: Tx) {
  const mov = await tx.movimientoTesoreria.findFirst({
    where: { pagoId, anuladoEn: null },
  })
  if (!mov) return null

  return tx.movimientoTesoreria.update({
    where: { id: mov.id },
    data: { anuladoEn: new Date() },
  })
}
