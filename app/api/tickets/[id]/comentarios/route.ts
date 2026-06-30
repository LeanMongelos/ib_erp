import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { ticketComentarioSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { puedeVerTicket } from '@/lib/tickets/crud'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('tickets.update')
    const { id } = await params
    const body = await req.json()
    const data = ticketComentarioSchema.parse(body)

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, solicitanteId: true, asignadoId: true, estado: true },
    })
    if (!ticket) throw new ApiError(404, 'Solicitud no encontrada')
    if (!puedeVerTicket(ticket, actor.id, actor.permissions)) {
      throw new ApiError(403, 'No tenés permiso para comentar esta solicitud')
    }
    if (data.esInterno && !tienePermiso(actor.permissions, 'tickets.read_all')) {
      throw new ApiError(403, 'No tenés permiso para comentarios internos')
    }
    if (['CERRADA', 'CANCELADA'].includes(ticket.estado)) {
      throw new ApiError(400, 'No se pueden agregar comentarios a una solicitud cerrada o cancelada')
    }

    const comentario = await prisma.ticketComentario.create({
      data: {
        ticketId: id,
        usuarioId: actor.id,
        texto: data.texto,
        esInterno: data.esInterno ?? false,
      },
      include: { usuario: { select: { id: true, nombre: true } } },
    })

    return NextResponse.json(plain(comentario), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
