import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'

export async function conciliarMovimiento(
  movimientoId: string,
  usuarioId: string,
  extractoRef?: string | null,
  nota?: string | null,
) {
  const mov = await prisma.movimientoTesoreria.findUnique({ where: { id: movimientoId } })
  if (!mov) throw new ApiError(404, 'Movimiento no encontrado')
  if (mov.anuladoEn) throw new ApiError(400, 'No se puede conciliar un movimiento anulado')
  if (mov.conciliadoEn) throw new ApiError(400, 'El movimiento ya está conciliado')
  if (mov.tipo === 'SALDO_INICIAL') {
    throw new ApiError(400, 'El saldo inicial no requiere conciliación')
  }

  return prisma.movimientoTesoreria.update({
    where: { id: movimientoId },
    data: {
      conciliadoEn: new Date(),
      conciliadoPorId: usuarioId,
      extractoRef: extractoRef?.trim() || null,
      notaConciliacion: nota?.trim() || null,
    },
    include: {
      cuentaTesoreria: { select: { id: true, nombre: true } },
      conciliadoPor: { select: { id: true, nombre: true } },
      pago: {
        select: {
          id: true,
          monto: true,
          cliente: { select: { nombre: true } },
        },
      },
    },
  })
}
