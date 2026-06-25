/**
 * Crea OT PREVENTIVO desde un plan de mantenimiento (idempotente por equipo).
 */
import { addDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { crearConNumeroUnico, siguienteNumeroOT } from '@/lib/sequences'

export type AgendarOTPreventivaResult = {
  ot: { id: string; numero: string }
  created: boolean
}

export async function agendarOTPreventiva(planId: string): Promise<AgendarOTPreventivaResult> {
  const plan = await prisma.planMantenimiento.findUnique({
    where: { id: planId },
    include: {
      equipo: {
        select: {
          id: true,
          nombre: true,
          clienteId: true,
        },
      },
    },
  })

  if (!plan) throw new ApiError(404, 'Plan no encontrado')
  if (!plan.equipo) throw new ApiError(400, 'El plan no tiene equipo asociado')
  if (['CANCELADO', 'COMPLETADO'].includes(plan.estado)) {
    throw new ApiError(400, 'No se puede agendar OT en un plan cancelado o completado')
  }

  const existente = await prisma.ordenTrabajo.findFirst({
    where: {
      equipoId: plan.equipoId,
      tipo: 'PREVENTIVO',
      estado: { in: ['ABIERTA', 'EN_PROCESO'] },
    },
    select: { id: true, numero: true },
    orderBy: { creadoEn: 'desc' },
  })

  if (existente) {
    return { ot: existente, created: false }
  }

  const objetivo = plan.proximoServicio ?? addDays(new Date(), plan.intervaloDias)
  const slaVence = addDays(objetivo, 7)

  const ot = await crearConNumeroUnico(siguienteNumeroOT, (numero) =>
    prisma.ordenTrabajo.create({
      data: {
        numero,
        tipo: 'PREVENTIVO',
        descripcion: `Mantenimiento preventivo — ${plan.descripcion}`,
        clienteId: plan.equipo.clienteId,
        equipoId: plan.equipoId,
        tecnicoId: plan.tecnicoId,
        estado: 'ABIERTA',
        prioridad: 'NORMAL',
        slaHoras: 168,
        slaVence,
        historial: {
          create: {
            estado: 'ABIERTA',
            nota: `OT preventiva agendada desde plan ${plan.id}. Fecha objetivo: ${objetivo.toISOString().slice(0, 10)}`,
          },
        },
      },
      select: { id: true, numero: true },
    }),
  )

  if (plan.estado === 'PENDIENTE' || plan.estado === 'VENCIDO') {
    await prisma.planMantenimiento.update({
      where: { id: plan.id },
      data: { estado: 'PROGRAMADO' },
    })
  }

  return { ot, created: true }
}
