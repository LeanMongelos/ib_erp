import { addDays } from 'date-fns'
import { prisma } from '@/lib/prisma'

export type GrupoCuotaAlquilerCobranza = {
  contratoId: string
  numeroContrato: string
  clienteNombre: string
  periodo: string
  vencimiento: Date
  montoTotal: number
  cantidadLineas: number
}

const whereBaseCuotaAlquiler = {
  facturaId: null as null,
  estado: { in: ['PENDIENTE', 'VENCIDA'] as ('PENDIENTE' | 'VENCIDA')[] },
  contrato: { estado: { in: ['ACTIVO', 'SUSPENDIDO'] as ('ACTIVO' | 'SUSPENDIDO')[] } },
}

function agruparCuotasAlquiler(
  cuotas: Array<{
    contratoId: string
    periodo: string
    monto: number
    vencimiento: Date
    contrato: { numero: string; cliente: { nombre: string } }
  }>,
): GrupoCuotaAlquilerCobranza[] {
  const grupos = new Map<string, typeof cuotas>()
  for (const c of cuotas) {
    const key = `${c.contratoId}:${c.periodo}`
    const arr = grupos.get(key) ?? []
    arr.push(c)
    grupos.set(key, arr)
  }

  const result: GrupoCuotaAlquilerCobranza[] = []
  for (const [, grupo] of grupos) {
    const first = grupo[0]!
    const vencimiento = grupo.reduce(
      (max, c) => (c.vencimiento > max ? c.vencimiento : max),
      first.vencimiento,
    )
    result.push({
      contratoId: first.contratoId,
      numeroContrato: first.contrato.numero,
      clienteNombre: first.contrato.cliente.nombre,
      periodo: first.periodo,
      vencimiento,
      montoTotal: grupo.reduce((s, c) => s + c.monto, 0),
      cantidadLineas: grupo.length,
    })
  }

  result.sort((a, b) => a.vencimiento.getTime() - b.vencimiento.getTime())
  return result
}

export async function contarCuotasAlquilerCobranzaVencidas(ahora = new Date()): Promise<number> {
  return prisma.cuotaAlquiler.count({
    where: {
      ...whereBaseCuotaAlquiler,
      vencimiento: { lt: ahora },
    },
  })
}

export async function listarGruposCuotasAlquilerCobranza(opts?: {
  vencidas?: boolean
  diasProximo?: number
  take?: number
  ahora?: Date
}): Promise<GrupoCuotaAlquilerCobranza[]> {
  const ahora = opts?.ahora ?? new Date()
  const take = opts?.take ?? 15

  let vencimientoFilter: { lt?: Date; gte?: Date; lte?: Date } | undefined

  if (opts?.vencidas) {
    vencimientoFilter = { lt: ahora }
  } else if (opts?.diasProximo != null) {
    vencimientoFilter = { gte: ahora, lte: addDays(ahora, opts.diasProximo) }
  }

  const cuotas = await prisma.cuotaAlquiler.findMany({
    where: {
      ...whereBaseCuotaAlquiler,
      ...(vencimientoFilter ? { vencimiento: vencimientoFilter } : {}),
    },
    include: {
      contrato: {
        select: {
          numero: true,
          cliente: { select: { nombre: true } },
        },
      },
    },
    orderBy: [{ vencimiento: 'asc' }, { periodo: 'asc' }],
  })

  return agruparCuotasAlquiler(cuotas).slice(0, take)
}
