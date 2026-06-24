import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'

export async function conciliarPago(pagoId: string, usuarioId: string) {
  const pago = await prisma.pago.findUnique({ where: { id: pagoId } })
  if (!pago) throw new ApiError(404, 'Pago no encontrado')
  if (pago.anuladoEn) throw new ApiError(400, 'No se puede conciliar un pago anulado')
  if (pago.conciliadoEn) throw new ApiError(400, 'El pago ya está conciliado')

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
    },
  })
}
