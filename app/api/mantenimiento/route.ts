import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { planMantenimientoCreateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { addDays } from 'date-fns'

export async function GET() {
  try {
    await requirePermission('preventivo.read')
    const planes = await prisma.planMantenimiento.findMany({
      orderBy: { proximoServicio: 'asc' },
      include: {
        equipo: { include: { cliente: { select: { nombre: true } } } },
        tecnico: { select: { nombre: true } },
      },
    })

    const equipoIds = [...new Set(planes.map((p) => p.equipoId))]
    const otsPreventivas = equipoIds.length
      ? await prisma.ordenTrabajo.findMany({
          where: {
            equipoId: { in: equipoIds },
            tipo: 'PREVENTIVO',
            estado: { in: ['ABIERTA', 'EN_PROCESO'] },
          },
          select: { id: true, numero: true, equipoId: true },
          orderBy: { creadoEn: 'desc' },
        })
      : []

    const otPorEquipo = new Map<string, { id: string; numero: string }>()
    for (const ot of otsPreventivas) {
      if (ot.equipoId && !otPorEquipo.has(ot.equipoId)) {
        otPorEquipo.set(ot.equipoId, { id: ot.id, numero: ot.numero })
      }
    }

    const enriched = planes.map((p) => ({
      ...p,
      otPreventiva: otPorEquipo.get(p.equipoId) ?? null,
    }))

    return NextResponse.json(plain(enriched))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('preventivo.schedule')
    const data = planMantenimientoCreateSchema.parse(await req.json())

    const proximo = data.proximoServicio ?? addDays(new Date(), data.intervaloDias)

    const plan = await prisma.planMantenimiento.create({
      data: {
        equipoId: data.equipoId,
        descripcion: data.descripcion,
        intervaloDias: data.intervaloDias,
        proximoServicio: proximo,
        tecnicoId: data.tecnicoId ?? null,
        notas: data.notas ?? null,
        estado: 'PROGRAMADO',
      },
      include: {
        equipo: { include: { cliente: { select: { nombre: true } } } },
        tecnico: { select: { nombre: true } },
      },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'mantenimiento.create',
      entidad: 'PlanMantenimiento',
      entidadId: plan.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(plan), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
