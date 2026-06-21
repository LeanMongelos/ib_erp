import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { eventoTrackingCreateSchema } from '@/lib/validation'
import { registrarEventoTracking } from '@/lib/tracking'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('tracking.read')
    const { searchParams } = new URL(req.url)
    const equipoId = searchParams.get('equipoId')

    const eventos = await prisma.eventoTracking.findMany({
      where: equipoId ? { equipoId } : undefined,
      orderBy: { fecha: 'desc' },
      take: equipoId ? 100 : 50,
      include: {
        equipo: {
          select: {
            nombre: true,
            numeroSerie: true,
            cliente: { select: { nombre: true } },
          },
        },
        usuario: { select: { nombre: true } },
      },
    })

    return NextResponse.json(plain(eventos))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('tracking.create')
    const data = eventoTrackingCreateSchema.parse(await req.json())

    const evento = await registrarEventoTracking({
      ...data,
      usuarioId: actor.id,
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'tracking.create',
      entidad: 'EventoTracking',
      entidadId: evento.id,
      despues: { tipo: data.tipo, equipoId: data.equipoId },
      ip: getIp(req),
    })

    return NextResponse.json(plain(evento), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
