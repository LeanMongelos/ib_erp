import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getStorage } from '@/lib/storage'
import { plain } from '@/lib/serialize'
import { puedeVerTicket } from '@/lib/tickets/crud'
import {
  TICKET_ADJUNTO_MAX_BYTES,
  TICKET_ADJUNTO_MIME_EXT,
  ticketAdjuntoKey,
  ticketAdjuntoMediaUrl,
} from '@/lib/tickets/adjunto-storage'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('tickets.update')
    const { id: ticketId } = await params

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, solicitanteId: true, asignadoId: true, estado: true },
    })
    if (!ticket) throw new ApiError(404, 'Solicitud no encontrada')
    if (!puedeVerTicket(ticket, actor.id, actor.permissions)) {
      throw new ApiError(403, 'Sin permiso')
    }
    if (['CERRADA', 'CANCELADA'].includes(ticket.estado)) {
      throw new ApiError(400, 'No se pueden adjuntar archivos a un ticket cerrado')
    }

    const form = await req.formData()
    const archivo = form.get('archivo')
    const comentarioId = form.get('comentarioId')?.toString() || null

    if (!archivo || !(archivo instanceof File)) {
      throw new ApiError(400, 'Seleccioná una imagen JPG o PNG')
    }
    if (!TICKET_ADJUNTO_MIME_EXT[archivo.type]) {
      throw new ApiError(400, 'Solo se permiten imágenes JPEG o PNG')
    }
    if (archivo.size > TICKET_ADJUNTO_MAX_BYTES) {
      throw new ApiError(400, 'La imagen no puede superar 5 MB')
    }

    if (comentarioId) {
      const com = await prisma.ticketComentario.findFirst({
        where: { id: comentarioId, ticketId },
      })
      if (!com) throw new ApiError(404, 'Comentario no encontrado')
    }

    const ext = TICKET_ADJUNTO_MIME_EXT[archivo.type]!
    const key = ticketAdjuntoKey(ticketId, ext)
    const storage = getStorage()
    const buf = Buffer.from(await archivo.arrayBuffer())
    await storage.put(key, buf, archivo.type)

    const adjunto = await prisma.ticketAdjunto.create({
      data: {
        ticketId,
        comentarioId,
        url: ticketAdjuntoMediaUrl(key),
        nombre: archivo.name.slice(0, 200) || null,
        mimeType: archivo.type,
        usuarioId: actor.id,
      },
    })

    return NextResponse.json(plain(adjunto), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
