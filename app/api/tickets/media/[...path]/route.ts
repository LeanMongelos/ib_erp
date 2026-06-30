import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getStorage } from '@/lib/storage'
import { puedeVerTicket } from '@/lib/tickets/crud'
import { prisma } from '@/lib/prisma'

const CONTENT_TYPE: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const actor = await requirePermission('tickets.read')
    const { path: segments } = await params
    const key = segments.join('/')

    if (!key.startsWith('tickets/adjuntos/') || key.includes('..')) {
      throw new ApiError(403, 'Ruta no permitida')
    }

    const ticketId = key.split('/')[2]
    if (!ticketId) throw new ApiError(403, 'Ruta no permitida')

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { solicitanteId: true, asignadoId: true },
    })
    if (!ticket || !puedeVerTicket(ticket, actor.id, actor.permissions)) {
      throw new ApiError(403, 'Sin permiso para ver este adjunto')
    }

    const storage = getStorage()
    if (!(await storage.exists(key))) throw new ApiError(404, 'Archivo no encontrado')

    const buf = await storage.get(key)
    const ext = path.extname(key).toLowerCase()
    const contentType = CONTENT_TYPE[ext] ?? 'application/octet-stream'

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400, immutable',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
