import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { addDays } from 'date-fns'

const mantenimientoUpdateSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PROGRAMADO', 'COMPLETADO', 'VENCIDO', 'CANCELADO']).optional(),
  proximoServicio: z.coerce.date().optional(),
  tecnicoId: z.string().min(1).optional().nullable(),
  notas: z.string().trim().max(500).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('preventivo.complete')
    const { id } = await params
    const data = mantenimientoUpdateSchema.parse(await req.json())

    const actual = await prisma.planMantenimiento.findUnique({ where: { id } })
    if (!actual) throw new ApiError(404, 'Plan no encontrado')

    const update: Record<string, unknown> = { ...data }

    if (data.estado === 'COMPLETADO') {
      update.ultimoServicio = new Date()
      update.proximoServicio = addDays(new Date(), actual.intervaloDias)
      update.estado = 'PROGRAMADO'
    }

    const plan = await prisma.planMantenimiento.update({
      where: { id },
      data: update,
      include: {
        equipo: { include: { cliente: { select: { nombre: true } } } },
        tecnico: { select: { nombre: true } },
      },
    })

    if (data.estado === 'COMPLETADO' && plan.equipoId) {
      const { registrarEntradaHistoria } = await import('@/lib/equipos/historia-clinica')
      await registrarEntradaHistoria(plan.equipoId, {
        tipo: 'PREVENTIVO',
        titulo: `Preventivo completado: ${plan.descripcion}`,
        contenido: plan.notas,
        referenciaId: plan.id,
        usuarioId: actor.id,
      })

      const equipoCliente = await prisma.equipo.findUnique({
        where: { id: plan.equipoId },
        select: { clienteId: true },
      })
      if (equipoCliente) {
        const { sincronizarTrackingPreventivoCompletado } = await import('@/lib/tracking-automation')
        await sincronizarTrackingPreventivoCompletado({
          equipoId: plan.equipoId,
          clienteId: equipoCliente.clienteId,
          planId: plan.id,
          descripcion: plan.descripcion,
          usuarioId: actor.id,
        }).catch(() => null)
      }
    }

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'mantenimiento.update',
      entidad: 'PlanMantenimiento',
      entidadId: id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(plan))
  } catch (error) {
    return handleApiError(error)
  }
}
