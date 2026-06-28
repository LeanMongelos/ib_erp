import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'

export async function suspenderContratoAlquiler(contratoId: string) {
  const contrato = await prisma.contratoAlquiler.findUnique({ where: { id: contratoId } })
  if (!contrato) throw new ApiError(404, 'Contrato no encontrado')
  if (contrato.estado !== 'ACTIVO') {
    throw new ApiError(400, 'Solo se pueden suspender contratos activos')
  }

  return prisma.contratoAlquiler.update({
    where: { id: contratoId },
    data: { estado: 'SUSPENDIDO' },
    include: { cliente: { select: { id: true, nombre: true } } },
  })
}

export async function reactivarContratoAlquiler(contratoId: string) {
  const contrato = await prisma.contratoAlquiler.findUnique({ where: { id: contratoId } })
  if (!contrato) throw new ApiError(404, 'Contrato no encontrado')
  if (contrato.estado !== 'SUSPENDIDO') {
    throw new ApiError(400, 'Solo se pueden reactivar contratos suspendidos')
  }

  return prisma.contratoAlquiler.update({
    where: { id: contratoId },
    data: { estado: 'ACTIVO' },
    include: { cliente: { select: { id: true, nombre: true } } },
  })
}

export async function cancelarContratoAlquiler(contratoId: string) {
  const contrato = await prisma.contratoAlquiler.findUnique({ where: { id: contratoId } })
  if (!contrato) throw new ApiError(404, 'Contrato no encontrado')
  if (contrato.estado !== 'BORRADOR') {
    throw new ApiError(400, 'Solo se pueden cancelar contratos en borrador')
  }

  return prisma.contratoAlquiler.update({
    where: { id: contratoId },
    data: { estado: 'CANCELADO' },
    include: { cliente: { select: { id: true, nombre: true } } },
  })
}
