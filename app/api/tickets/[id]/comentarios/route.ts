import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { ticketComentarioSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { puedeVerTicket } from '@/lib/tickets/crud'
import { prisma } from '@/lib/prisma'
import { registrarComentarioConFeedback } from '@/lib/tickets/feedback'
import { tienePermiso } from '@/lib/rbac'

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
    if (!ticket) throw new ApiError(404, 'Ticket no encontrado')
    if (!puedeVerTicket(ticket, actor.id, actor.permissions)) {
      throw new ApiError(403, 'No tenés permiso para comentar este ticket')
    }
    if (data.esInterno && !tienePermiso(actor.permissions, 'tickets.read_all')) {
      throw new ApiError(403, 'No tenés permiso para comentarios internos')
    }
    if (data.esPregunta && !tienePermiso(actor.permissions, 'tickets.assign')) {
      throw new ApiError(403, 'No tenés permiso para pedir más información')
    }
    if (['CERRADA', 'CANCELADA'].includes(ticket.estado)) {
      throw new ApiError(400, 'No se pueden agregar comentarios a un ticket cerrado')
    }

    const comentario = await registrarComentarioConFeedback(id, actor, {
      texto: data.texto,
      esInterno: data.esInterno ?? false,
      esPregunta: data.esPregunta ?? false,
    })

    return NextResponse.json(plain(comentario), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Solo quien')) {
      return handleApiError(new ApiError(403, error.message))
    }
    return handleApiError(error)
  }
}
