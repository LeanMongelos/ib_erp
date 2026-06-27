import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { conciliarMovimiento } from '@/lib/tesoreria/conciliar'

export async function conciliarPago(pagoId: string, usuarioId: string) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: { movimientoTesoreria: true },
  })
  if (!pago) throw new ApiError(404, 'Pago no encontrado')
  if (pago.anuladoEn) throw new ApiError(400, 'No se puede conciliar un pago anulado')
  if (pago.conciliadoEn) throw new ApiError(400, 'El pago ya está conciliado')

  const mov = pago.movimientoTesoreria
  if (mov && !mov.anuladoEn && !mov.conciliadoEn) {
    await conciliarMovimiento(mov.id, usuarioId)
  }

  return prisma.pago.update({
    where: { id: pagoId },
    data: {
      conciliadoEn: new Date(),
      conciliadoPorId: usuarioId,
    },
    include: {
      cliente: { select: { nombre: true } },
      conciliadoPor: { select: { id: true, nombre: true } },
      imputaciones: { include: { factura: { select: { numero: true } } } },
      movimientoTesoreria: {
        select: {
          id: true,
          conciliadoEn: true,
          extractoRef: true,
        },
      },
    },
  })
}
