import type { Prisma } from '@prisma/client'
import { ApiError } from '@/lib/api-auth'
import { resolverCuentaTesoreriaParaPago } from '@/lib/tesoreria/cuenta-default'

type Tx = Prisma.TransactionClient

export async function registrarIngresoDesdePago(
  pagoId: string,
  usuarioId: string,
  tx: Tx,
  cuentaTesoreriaId?: string | null,
) {
  const pago = await tx.pago.findUnique({
    where: { id: pagoId },
    include: { cliente: { select: { nombre: true } } },
  })
  if (!pago) throw new ApiError(404, 'Pago no encontrado')
  if (pago.anuladoEn) throw new ApiError(400, 'El pago está anulado')

  const existente = await tx.movimientoTesoreria.findFirst({
    where: { pagoId, anuladoEn: null },
  })
  if (existente) return existente

  const cuentaId = cuentaTesoreriaId ?? pago.cuentaTesoreriaId
  const cuenta = await resolverCuentaTesoreriaParaPago(pago.medio, cuentaId, tx)

  if (!pago.cuentaTesoreriaId) {
    await tx.pago.update({
      where: { id: pagoId },
      data: { cuentaTesoreriaId: cuenta.id },
    })
  }

  const descripcion = `Cobranza — ${pago.cliente.nombre}`
  const referencia = pago.referencia ?? undefined

  return tx.movimientoTesoreria.create({
    data: {
      cuentaTesoreriaId: cuenta.id,
      fecha: pago.fecha,
      tipo: 'INGRESO',
      monto: pago.monto,
      descripcion,
      referencia: referencia ?? null,
      pagoId: pago.id,
      creadoPorId: usuarioId,
    },
  })
}
