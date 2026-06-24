import { NextRequest, NextResponse } from 'next/server'
import { addHours } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError } from '@/lib/api-auth'
import { otCreateSchema, estadoOTEnum } from '@/lib/validation'
import { siguienteNumeroOT, crearConNumeroUnico } from '@/lib/sequences'
import { actualizarOTsVencidas } from '@/lib/ots'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('servicio.read')

    // Antes de listar, sincronizamos las OTs cuyo SLA ya venció
    await actualizarOTsVencidas()

    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId')
    const estadoRaw = searchParams.get('estado')
    const estado =
      estadoRaw && estadoRaw !== 'TODOS' && estadoOTEnum.safeParse(estadoRaw).success
        ? estadoRaw
        : null

    const ots = await prisma.ordenTrabajo.findMany({
      where: {
        ...(clienteId && { clienteId }),
        ...(estado && { estado: estado as any }),
      },
      orderBy: { creadoEn: 'desc' },
      include: {
        cliente:  { select: { nombre: true } },
        equipo:   { select: { nombre: true } },
        tecnico:  { select: { nombre: true } },
      },
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
