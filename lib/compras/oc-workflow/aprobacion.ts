import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { validarEnvioOC } from '@/lib/compras/oc-enviar'
import { ocInclude } from '@/lib/compras/oc-include'
import { registrarEventoOC } from '@/lib/compras/oc-workflow/eventos'
import {
  notificarAprobadoresOcPendiente,
  notificarSolicitanteOc,
  resolverNotificacionesAprobacionPendiente,
} from '@/lib/compras/oc-workflow/notificaciones'

export async function enviarOcAprobacion(ordenCompraId: string, actorId: string) {
  const oc = await prisma.ordenCompra.findUnique({
    where: { id: ordenCompraId },
    include: { items: true, solicitante: { select: { nombre: true } } },
  })
  if (!oc) throw new ApiError(404, 'Orden de compra no encontrada')
  if (oc.estado !== 'BORRADOR' && oc.estado !== 'RECHAZADA') {
    throw new ApiError(400, `Solo se envían a aprobación OC en borrador o rechazadas (actual: ${oc.estado})`)
  }

  const solicitanteId = oc.solicitanteId ?? actorId
  const err = validarEnvioOC({
    solicitanteId,
    justificacion: oc.justificacion,
    clasificacionOrigen: oc.clasificacionOrigen,
    items: oc.items,
  })
  if (err) throw new ApiError(400, err)

  const esReenvio = oc.estado === 'RECHAZADA'

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ordenCompra.update({
      where: { id: ordenCompraId },
      data: {
        estado: 'PENDIENTE_APROBACION',
        solicitanteId,
        enviadaAprobacionEn: new Date(),
        rechazadoPorId: null,
        rechazadoEn: null,
        rechazadoMotivo: null,
        aprobadoPorId: null,
        aprobadoEn: null,
      },
      include: ocInclude,
    })

    await registrarEventoOC(
      {
        ordenCompraId,
        tipo: esReenvio ? 'OC_REENVIADA' : 'OC_ENVIADA_APROBACION',
        usuarioId: actorId,
        referencia: updated.numero,
        payload: { solicitanteId, justificacion: oc.justificacion },
      },
      tx,
    )

    await notificarAprobadoresOcPendiente(
      {
        id: updated.id,
        numero: updated.numero,
        justificacion: updated.justificacion,
        solicitanteId: updated.solicitanteId,
        creadoPorId: updated.creadoPorId,
        solicitante: updated.solicitante,
      },
      tx,
    )

    return updated
  })
}

export async function aprobarOc(ordenCompraId: string, actorId: string, actorNombre: string) {
  const oc = await prisma.ordenCompra.findUnique({
    where: { id: ordenCompraId },
    include: { solicitante: { select: { id: true, nombre: true } } },
  })
  if (!oc) throw new ApiError(404, 'Orden de compra no encontrada')
  if (oc.estado !== 'PENDIENTE_APROBACION') {
    throw new ApiError(400, `Solo se aprueban OC pendientes de aprobación (actual: ${oc.estado})`)
  }
  if (oc.aprobadoPorId) {
    throw new ApiError(400, 'Esta OC ya fue aprobada')
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ordenCompra.update({
      where: { id: ordenCompraId },
      data: {
        estado: 'APROBADA',
        aprobadoPorId: actorId,
        aprobadoEn: new Date(),
      },
      include: ocInclude,
    })

    await registrarEventoOC(
      {
        ordenCompraId,
        tipo: 'OC_APROBADA',
        usuarioId: actorId,
        referencia: updated.numero,
        payload: { aprobadoPor: actorNombre },
      },
      tx,
    )

    await resolverNotificacionesAprobacionPendiente(ordenCompraId, tx)

    await notificarSolicitanteOc(
      {
        id: updated.id,
        numero: updated.numero,
        solicitanteId: updated.solicitanteId,
        creadoPorId: updated.creadoPorId,
        solicitante: updated.solicitante,
      },
      'OC_APROBADA',
      actorNombre,
      undefined,
      tx,
    )

    return updated
  })
}

export async function rechazarOc(
  ordenCompraId: string,
  actorId: string,
  actorNombre: string,
  motivo: string,
) {
  const oc = await prisma.ordenCompra.findUnique({
    where: { id: ordenCompraId },
    include: { solicitante: { select: { id: true, nombre: true } } },
  })
  if (!oc) throw new ApiError(404, 'Orden de compra no encontrada')
  if (oc.estado !== 'PENDIENTE_APROBACION') {
    throw new ApiError(400, `Solo se rechazan OC pendientes de aprobación (actual: ${oc.estado})`)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ordenCompra.update({
      where: { id: ordenCompraId },
      data: {
        estado: 'RECHAZADA',
        rechazadoPorId: actorId,
        rechazadoEn: new Date(),
        rechazadoMotivo: motivo,
      },
      include: ocInclude,
    })

    await registrarEventoOC(
      {
        ordenCompraId,
        tipo: 'OC_RECHAZADA',
        usuarioId: actorId,
        referencia: updated.numero,
        payload: { motivo, rechazadoPor: actorNombre },
      },
      tx,
    )

    await resolverNotificacionesAprobacionPendiente(ordenCompraId, tx)

    await notificarSolicitanteOc(
      {
        id: updated.id,
        numero: updated.numero,
        solicitanteId: updated.solicitanteId,
        creadoPorId: updated.creadoPorId,
        solicitante: updated.solicitante,
      },
      'OC_RECHAZADA',
      actorNombre,
      { motivo },
      tx,
    )

    return updated
  })
}

export async function registrarOcCreada(ordenCompraId: string, actorId: string, numero: string) {
  await registrarEventoOC({
    ordenCompraId,
    tipo: 'OC_CREADA',
    usuarioId: actorId,
    referencia: numero,
  })
}
