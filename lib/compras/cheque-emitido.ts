import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { ApiError } from '@/lib/api-auth'
import { calcularSaldo } from '@/lib/tesoreria/saldo'

type Tx = Prisma.TransactionClient

async function validarChequeUnico(numero: string, banco: string | null | undefined, tx: Tx) {
  const bancoNorm = (banco ?? '').trim()
  const existente = await tx.chequeEmitido.findFirst({
    where: {
      numero: numero.trim(),
      banco: bancoNorm,
      estado: { in: ['EMITIDO', 'DEBITADO'] },
    },
  })
  if (existente) {
    throw new ApiError(400, `Ya existe un cheque emitido activo N° ${numero}`)
  }
}

export async function crearChequeEmitido(
  data: {
    pagoProveedorId?: string | null
    proveedorId: string
    numero: string
    banco?: string | null
    monto: number
    fechaEmision?: Date
    fechaDebito?: Date | null
    cuentaTesoreriaId: string
  },
  tx: Tx,
) {
  await validarChequeUnico(data.numero, data.banco, tx)

  const cuenta = await tx.cuentaTesoreria.findUnique({ where: { id: data.cuentaTesoreriaId } })
  if (!cuenta) throw new ApiError(404, 'Cuenta de tesorería no encontrada')
  if (!cuenta.activa) throw new ApiError(400, 'La cuenta está inactiva')
  if (cuenta.tipo !== 'BANCO') {
    throw new ApiError(400, 'Los cheques emitidos deben asociarse a una cuenta bancaria')
  }

  return tx.chequeEmitido.create({
    data: {
      pagoProveedorId: data.pagoProveedorId ?? null,
      proveedorId: data.proveedorId,
      numero: data.numero.trim(),
      banco: (data.banco ?? '').trim(),
      monto: data.monto,
      fechaEmision: data.fechaEmision ?? new Date(),
      fechaDebito: data.fechaDebito ?? null,
      cuentaTesoreriaId: data.cuentaTesoreriaId,
      estado: 'EMITIDO',
    },
    include: {
      proveedor: { select: { razonSocial: true } },
      cuentaTesoreria: { select: { id: true, nombre: true } },
    },
  })
}

export async function marcarChequeDebitado(chequeId: string, usuarioId: string, fechaDebito?: Date) {
  return prisma.$transaction(async (tx) => {
    const cheque = await tx.chequeEmitido.findUnique({
      where: { id: chequeId },
      include: {
        proveedor: { select: { razonSocial: true } },
        pagoProveedor: true,
        movimientoTesoreria: true,
      },
    })
    if (!cheque) throw new ApiError(404, 'Cheque emitido no encontrado')
    if (cheque.estado !== 'EMITIDO') {
      throw new ApiError(400, 'Solo se pueden debitar cheques en estado emitido')
    }

    const fecha = fechaDebito ?? new Date()
    if (Number.isNaN(fecha.getTime())) throw new ApiError(400, 'Fecha de débito inválida')

    let movimientoId = cheque.movimientoTesoreriaId

    if (!movimientoId) {
      const saldo = await calcularSaldo(cheque.cuentaTesoreriaId)
      if (saldo - cheque.monto < -0.01) {
        throw new ApiError(400, 'Saldo insuficiente para debitar el cheque')
      }

      const descripcion = cheque.pagoProveedor
        ? `Cheque emitido — ${cheque.proveedor.razonSocial}`
        : `Cheque emitido — ${cheque.proveedor.razonSocial}`

      const mov = await tx.movimientoTesoreria.create({
        data: {
          cuentaTesoreriaId: cheque.cuentaTesoreriaId,
          fecha,
          tipo: 'EGRESO',
          monto: cheque.monto,
          descripcion,
          referencia: cheque.numero,
          pagoProveedorId: cheque.pagoProveedorId ?? null,
          creadoPorId: usuarioId,
        },
      })
      movimientoId = mov.id
    }

    return tx.chequeEmitido.update({
      where: { id: chequeId },
      data: {
        estado: 'DEBITADO',
        fechaDebito: fecha,
        movimientoTesoreriaId: movimientoId,
      },
      include: {
        proveedor: { select: { razonSocial: true } },
        cuentaTesoreria: { select: { id: true, nombre: true } },
        pagoProveedor: { select: { id: true, monto: true, medio: true, estado: true } },
        movimientoTesoreria: true,
      },
    })
  })
}

export async function anularChequeEmitido(chequeId: string) {
  return prisma.$transaction(async (tx) => {
    const cheque = await tx.chequeEmitido.findUnique({ where: { id: chequeId } })
    if (!cheque) throw new ApiError(404, 'Cheque emitido no encontrado')
    if (cheque.estado === 'DEBITADO') {
      throw new ApiError(400, 'No se puede anular un cheque ya debitado')
    }

    return tx.chequeEmitido.update({
      where: { id: chequeId },
      data: { estado: 'ANULADO' },
    })
  })
}
