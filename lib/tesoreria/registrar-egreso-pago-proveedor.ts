import type { Prisma } from '@prisma/client'
import { ApiError } from '@/lib/api-auth'
import { resolverCuentaTesoreriaParaPago } from '@/lib/tesoreria/cuenta-default'
import { calcularSaldo } from '@/lib/tesoreria/saldo'

type Tx = Prisma.TransactionClient

export async function registrarEgresoDesdePagoProveedor(
  pagoProveedorId: string,
  usuarioId: string,
  tx: Tx,
  cuentaTesoreriaId?: string | null,
) {
  const pago = await tx.pagoProveedor.findUnique({
    where: { id: pagoProveedorId },
    include: { proveedor: { select: { razonSocial: true } } },
  })
  if (!pago) throw new ApiError(404, 'Pago a proveedor no encontrado')
  if (pago.anuladoEn || pago.estado === 'ANULADO') {
    throw new ApiError(400, 'El pago está anulado')
  }
  if (pago.medio === 'CHEQUE') {
    throw new ApiError(400, 'Los pagos con cheque se debitan al marcar el cheque')
  }

  const existente = await tx.movimientoTesoreria.findFirst({
    where: { pagoProveedorId, anuladoEn: null },
  })
  if (existente) return existente

  const cuentaId = cuentaTesoreriaId ?? pago.cuentaTesoreriaId
  const cuenta = await resolverCuentaTesoreriaParaPago(pago.medio, cuentaId, tx)

  if (!pago.cuentaTesoreriaId) {
    await tx.pagoProveedor.update({
      where: { id: pagoProveedorId },
      data: { cuentaTesoreriaId: cuenta.id },
    })
  }

  const saldo = await calcularSaldo(cuenta.id)
  if (saldo - pago.monto < -0.01) {
    throw new ApiError(400, 'Saldo insuficiente para registrar el egreso')
  }

  const descripcion = `Pago proveedor — ${pago.proveedor.razonSocial}`

  return tx.movimientoTesoreria.create({
    data: {
      cuentaTesoreriaId: cuenta.id,
      fecha: pago.fecha,
      tipo: 'EGRESO',
      monto: pago.monto,
      descripcion,
      referencia: pago.referencia ?? null,
      pagoProveedorId: pago.id,
      creadoPorId: usuarioId,
    },
  })
}

export async function anularMovimientoPorPagoProveedor(pagoProveedorId: string, tx: Tx) {
  const mov = await tx.movimientoTesoreria.findFirst({
    where: { pagoProveedorId, anuladoEn: null },
  })
  if (!mov) return null

  return tx.movimientoTesoreria.update({
    where: { id: mov.id },
    data: { anuladoEn: new Date() },
  })
}
