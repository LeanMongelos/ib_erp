import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { devolverLineaAlquiler } from '@/lib/alquiler/devolver-linea'

export async function finalizarContratoAlquiler(
  contratoId: string,
  usuarioId?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const contrato = await tx.contratoAlquiler.findUnique({
      where: { id: contratoId },
      include: { lineas: { where: { activa: true } } },
    })

    if (!contrato) throw new ApiError(404, 'Contrato no encontrado')
    if (!['ACTIVO', 'SUSPENDIDO'].includes(contrato.estado)) {
      throw new ApiError(400, 'Solo se pueden finalizar contratos activos o suspendidos')
    }

    for (const linea of contrato.lineas) {
      await devolverLineaAlquiler(
        linea.id,
        { usuarioId, nota: `Finalización contrato ${contrato.numero}` },
        tx,
      )
    }

    await tx.cuotaAlquiler.updateMany({
      where: {
        contratoId,
        estado: { in: ['PENDIENTE', 'VENCIDA'] },
        facturaId: null,
      },
      data: { estado: 'ANULADA' },
    })

    return tx.contratoAlquiler.update({
      where: { id: contratoId },
      data: { estado: 'FINALIZADO', fechaFin: new Date() },
      include: {
        cliente: { select: { id: true, nombre: true } },
        lineas: true,
        cuotas: true,
      },
    })
  })
}
