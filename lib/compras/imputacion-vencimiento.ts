import type { Prisma } from '@prisma/client'
import { ApiError } from '@/lib/api-auth'

type Tx = Prisma.TransactionClient

export async function imputarMontoAVencimiento(
  vencimientoPagoId: string,
  monto: number,
  tx: Tx,
) {
  const venc = await tx.vencimientoPago.findUnique({
    where: { id: vencimientoPagoId },
    include: { facturaCompra: { select: { estado: true } } },
  })
  if (!venc) throw new ApiError(404, 'Vencimiento no encontrado')
  if (venc.facturaCompra.estado !== 'REGISTRADA') {
    throw new ApiError(400, 'La factura de compra no está registrada')
  }
  if (venc.pagado || venc.saldo <= 0.009) {
    throw new ApiError(400, 'El vencimiento ya está pagado')
  }
  if (monto > venc.saldo + 0.01) {
    throw new ApiError(400, 'El monto excede el saldo del vencimiento')
  }

  const nuevoSaldo = Math.round((venc.saldo - monto) * 100) / 100
  const pagado = nuevoSaldo <= 0.009

  await tx.vencimientoPago.update({
    where: { id: vencimientoPagoId },
    data: {
      saldo: pagado ? 0 : nuevoSaldo,
      pagado,
      pagadoEn: pagado ? new Date() : null,
    },
  })
}

export async function revertirImputacionVencimiento(
  vencimientoPagoId: string,
  monto: number,
  tx: Tx,
) {
  const venc = await tx.vencimientoPago.findUnique({ where: { id: vencimientoPagoId } })
  if (!venc) throw new ApiError(404, 'Vencimiento no encontrado')

  const nuevoSaldo = Math.min(Math.round((venc.saldo + monto) * 100) / 100, venc.monto)
  const pagado = nuevoSaldo <= 0.009

  await tx.vencimientoPago.update({
    where: { id: vencimientoPagoId },
    data: {
      saldo: pagado ? 0 : nuevoSaldo,
      pagado,
      pagadoEn: pagado ? venc.pagadoEn ?? new Date() : null,
    },
  })
}
