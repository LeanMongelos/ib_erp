import { NextRequest, NextResponse } from 'next/server'
import { addHours } from 'date-fns'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { otCreateSchema, estadoOTEnum, prioridadEnum, tipoOTEnum } from '@/lib/validation'
import { siguienteNumeroOT, crearConNumeroUnico } from '@/lib/sequences'
import { actualizarOTsVencidas } from '@/lib/ots'

const SLA_FILTROS = ['VENCIDO', 'PROXIMO', 'OK'] as const
type SlaFiltro = (typeof SLA_FILTROS)[number]

function parseSlaFiltro(raw: string | null): SlaFiltro | null {
  if (!raw || raw === 'TODOS') return null
  return SLA_FILTROS.includes(raw as SlaFiltro) ? (raw as SlaFiltro) : null
}

function whereSlaFiltro(sla: SlaFiltro, ahora: Date): Prisma.OrdenTrabajoWhereInput {
  const en24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000)
  if (sla === 'VENCIDO') {
    return {
      OR: [{ estado: 'VENCIDA' }, { slaVence: { lt: ahora }, estado: { in: ['ABIERTA', 'EN_PROCESO'] } }],
    }
  }
  if (sla === 'PROXIMO') {
    return {
      estado: { in: ['ABIERTA', 'EN_PROCESO'] },
      slaVence: { gte: ahora, lte: en24h },
    }
  }
  return {
    estado: { in: ['ABIERTA', 'EN_PROCESO'] },
    slaVence: { gt: en24h },
  }
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission('servicio.read')

    // Antes de listar, sincronizamos las OTs cuyo SLA ya venció
    await actualizarOTsVencidas()

    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId')
    const tecnicoId = searchParams.get('tecnicoId')
    const q = searchParams.get('q')?.trim()
    const estadoRaw = searchParams.get('estado')
    const estado =
      estadoRaw && estadoRaw !== 'TODOS' && estadoOTEnum.safeParse(estadoRaw).success
        ? estadoRaw
        : null
    const prioridadRaw = searchParams.get('prioridad')
    const prioridad =
      prioridadRaw && prioridadRaw !== 'TODOS' && prioridadEnum.safeParse(prioridadRaw).success
        ? prioridadRaw
        : null
    const tipoRaw = searchParams.get('tipo')
    const tipo =
      tipoRaw && tipoRaw !== 'TODOS' && tipoOTEnum.safeParse(tipoRaw).success ? tipoRaw : null
    const sla = parseSlaFiltro(searchParams.get('sla'))
    const ahora = new Date()

    const ots = await prisma.ordenTrabajo.findMany({
      where: {
        ...(clienteId && { clienteId }),
        ...(tecnicoId && { tecnicoId }),
        ...(estado && { estado: estado as Prisma.EnumEstadoOTFilter['equals'] }),
        ...(prioridad && { prioridad: prioridad as Prisma.EnumPrioridadFilter['equals'] }),
        ...(tipo && { tipo: tipo as Prisma.EnumTipoOTFilter['equals'] }),
        ...(sla && whereSlaFiltro(sla, ahora)),
        ...(q && {
          OR: [
            { numero: { contains: q, mode: 'insensitive' } },
            { descripcion: { contains: q, mode: 'insensitive' } },
            { cliente: { nombre: { contains: q, mode: 'insensitive' } } },
            { equipo: { nombre: { contains: q, mode: 'insensitive' } } },
          ],
        }),
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
