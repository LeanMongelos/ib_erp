import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { ticketUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { obtenerTicketDetalle, puedeVerTicket } from '@/lib/tickets/crud'
import { validarTransicionTicket } from '@/lib/tickets/transiciones'
import { marcarAlertasTicketLeidas } from '@/lib/tickets/notificaciones-inbox'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('tickets.read')
    const { id } = await params

    const ticket = await obtenerTicketDetalle(id)
    if (!ticket) throw new ApiError(404, 'Solicitud no encontrada')
    if (!puedeVerTicket(ticket, actor.id, actor.permissions)) {
      throw new ApiError(403, 'No tenés permiso para ver esta solicitud')
    }

    const comentarios = ticket.comentarios.filter(
      (c) => !c.esInterno || tienePermiso(actor.permissions, 'tickets.read_all'),
    )

    void marcarAlertasTicketLeidas(actor.id, id)

    return NextResponse.json(plain({ ...ticket, comentarios }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const data = ticketUpdateSchema.parse(body)

    const actual = await prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        solicitanteId: true,
        asignadoId: true,
        titulo: true,
      },
    })
    if (!actual) throw new ApiError(404, 'Solicitud no encontrada')
    if (!puedeVerTicket(actual, actor.id, actor.permissions)) {
      throw new ApiError(403, 'No tenés permiso para editar esta solicitud')
    }

    if (
      data.estado !== undefined &&
      !tienePermiso(actor.permissions, 'tickets.assign') &&
      !tienePermiso(actor.permissions, 'tickets.close')
    ) {
      throw new ApiError(403, 'No tenés permiso para cambiar el estado')
    }

    if (data.estado !== undefined && data.estado !== actual.estado) {
      const err = validarTransicionTicket(actual.estado, data.estado)
      if (err) throw new ApiError(400, err)
      if (data.estado === 'CERRADA' && !tienePermiso(actor.permissions, 'tickets.close')) {
        throw new ApiError(403, 'No tenés permiso para cerrar solicitudes')
      }
      if (data.estado === 'CERRADA' && !data.resolucion?.trim()) {
        const resolucionActual = await prisma.ticket.findUnique({
          where: { id },
          select: { resolucion: true },
        })
        if (!resolucionActual?.resolucion?.trim()) {
          throw new ApiError(400, 'Indicá la resolución al cerrar la solicitud')
        }
      }
    }

    if (
      data.asignadoId !== undefined &&
      data.asignadoId !== actual.asignadoId &&
      !tienePermiso(actor.permissions, 'tickets.assign')
    ) {
      throw new ApiError(403, 'No tenés permiso para asignar solicitudes')
    }

    const updateData: Prisma.TicketUpdateInput = {}
    if (data.titulo !== undefined) updateData.titulo = data.titulo
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion
    if (data.tipo !== undefined) updateData.tipo = data.tipo
    if (data.areaDestino !== undefined) updateData.areaDestino = data.areaDestino
    if (data.prioridad !== undefined) updateData.prioridad = data.prioridad
    if (data.resolucion !== undefined) updateData.resolucion = data.resolucion
    if (data.asignadoId !== undefined) {
      updateData.asignado = data.asignadoId
        ? { connect: { id: data.asignadoId } }
        : { disconnect: true }
    }

    if (data.estado !== undefined && data.estado !== actual.estado) {
      updateData.estado = data.estado
      if (data.estado === 'CERRADA') {
        updateData.cerradoEn = new Date()
      } else if (actual.estado === 'CERRADA') {
        updateData.cerradoEn = null
      }
      updateData.historial = {
        create: {
          estado: data.estado,
          nota: data.nota ?? `Estado cambiado a ${data.estado}`,
          usuarioId: actor.id,
        },
      }
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        solicitante: { select: { id: true, nombre: true, email: true } },
        asignado: { select: { id: true, nombre: true, email: true } },
      },
    })

    return NextResponse.json(plain(ticket))
  } catch (error) {
    return handleApiError(error)
  }
}
