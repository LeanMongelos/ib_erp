import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { TipoOT } from '@/types'

const TIPOS_ELEGIBLES: TipoOT[] = ['CORRECTIVO', 'GARANTIA', 'CALIBRACION']
const ESTADOS_PLAN_ACTIVO = ['PENDIENTE', 'PROGRAMADO', 'VENCIDO'] as const

type Db = Prisma.TransactionClient | typeof prisma

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

async function resolverIntervaloDias(equipoId: string, db: Db): Promise<number> {
  const equipo = await db.equipo.findUnique({
    where: { id: equipoId },
    select: {
      itemFacturaOrigen: {
        select: {
          inventario: { select: { intervaloPreventivoDias: true } },
        },
      },
    },
  })

  const dias = equipo?.itemFacturaOrigen?.inventario?.intervaloPreventivoDias
  if (dias && dias > 0) return dias
  return 180
}

export async function crearPlanPreventivoPostCierre(opts: {
  otId: string
  otNumero: string
  tipo: TipoOT
  equipoId: string
  tecnicoId?: string | null
  tx?: Prisma.TransactionClient
}): Promise<{ creado: boolean; planId?: string; motivo?: string }> {
  if (!TIPOS_ELEGIBLES.includes(opts.tipo)) {
    return { creado: false, motivo: 'tipo_no_elegible' }
  }

  const db: Db = opts.tx ?? prisma

  const activo = await db.planMantenimiento.findFirst({
    where: {
      equipoId: opts.equipoId,
      estado: { in: [...ESTADOS_PLAN_ACTIVO] },
    },
    select: { id: true },
  })
  if (activo) return { creado: false, motivo: 'plan_activo_existente', planId: activo.id }

  const intervaloDias = await resolverIntervaloDias(opts.equipoId, db)
  const proximoServicio = addDays(new Date(), intervaloDias)

  const equipo = await db.equipo.findUnique({
    where: { id: opts.equipoId },
    select: { nombre: true },
  })

  const plan = await db.planMantenimiento.create({
    data: {
      equipoId: opts.equipoId,
      descripcion: `Preventivo — ${equipo?.nombre ?? 'equipo'}`,
      intervaloDias,
      proximoServicio,
      ultimoServicio: new Date(),
      estado: 'PROGRAMADO',
      tecnicoId: opts.tecnicoId ?? null,
      notas: `Generado al cerrar OT ${opts.otNumero} (${opts.tipo})`,
    },
  })

  return { creado: true, planId: plan.id }
}
