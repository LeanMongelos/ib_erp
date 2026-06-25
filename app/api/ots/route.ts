import { NextRequest, NextResponse } from 'next/server'
import { addHours } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { otCreateSchema } from '@/lib/validation'
import { siguienteNumeroOT, crearConNumeroUnico } from '@/lib/sequences'
import { listarOTs } from '@/lib/ots/listar-ots'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('servicio.read')

    const { searchParams } = new URL(req.url)
    const ots = await listarOTs({
      q: searchParams.get('q'),
      estado: searchParams.get('estado'),
      tecnicoId: searchParams.get('tecnicoId'),
      clienteId: searchParams.get('clienteId'),
      prioridad: searchParams.get('prioridad'),
      tipo: searchParams.get('tipo'),
      sla: searchParams.get('sla'),
    })

    return NextResponse.json(ots)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('servicio.create')

    const body = await req.json()
    const { descripcion, clienteId, equipoId, tecnicoId, prioridad, slaHoras, tipo } =
      otCreateSchema.parse(body)

    const slaVence = addHours(new Date(), slaHoras)

    const ot = await crearConNumeroUnico(
      siguienteNumeroOT,
      (numero) =>
        prisma.ordenTrabajo.create({
          data: {
            numero,
            tipo,
            descripcion,
            clienteId,
            equipoId:  equipoId  ?? null,
            tecnicoId: tecnicoId ?? null,
            prioridad,
            slaHoras,
            slaVence,
            estado: 'ABIERTA',
            historial: {
              create: { estado: 'ABIERTA', nota: 'OT creada' },
            },
          },
          include: { cliente: true, equipo: true, tecnico: true },
        }),
    )
    return NextResponse.json(ot, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
