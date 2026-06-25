/**
 * Listado de OTs con filtros — compartido por GET /api/ots y tests.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { estadoOTEnum, prioridadEnum, tipoOTEnum } from '@/lib/validation'
import { actualizarOTsVencidas } from '@/lib/ots'

const SLA_FILTROS = ['VENCIDO', 'PROXIMO', 'OK'] as const
export type SlaFiltro = (typeof SLA_FILTROS)[number]

export type FiltrosListadoOT = {
  q?: string | null
  estado?: string | null
  tecnicoId?: string | null
  clienteId?: string | null
  prioridad?: string | null
  tipo?: string | null
  sla?: string | null
}

export function parseSlaFiltro(raw: string | null | undefined): SlaFiltro | null {
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

function parseEstado(raw: string | null | undefined): string | null {
  if (!raw || raw === 'TODOS') return null
  return estadoOTEnum.safeParse(raw).success ? raw : null
}

function parsePrioridad(raw: string | null | undefined): string | null {
  if (!raw || raw === 'TODOS') return null
  return prioridadEnum.safeParse(raw).success ? raw : null
}

function parseTipo(raw: string | null | undefined): string | null {
  if (!raw || raw === 'TODOS') return null
  return tipoOTEnum.safeParse(raw).success ? raw : null
}

export function buildWhereListadoOT(filtros: FiltrosListadoOT, ahora = new Date()): Prisma.OrdenTrabajoWhereInput {
  const q = filtros.q?.trim()
  const estado = parseEstado(filtros.estado)
  const prioridad = parsePrioridad(filtros.prioridad)
  const tipo = parseTipo(filtros.tipo)
  const sla = parseSlaFiltro(filtros.sla)

  return {
    ...(filtros.clienteId && { clienteId: filtros.clienteId }),
    ...(filtros.tecnicoId && { tecnicoId: filtros.tecnicoId }),
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
  }
}

export async function listarOTs(filtros: FiltrosListadoOT = {}) {
  await actualizarOTsVencidas()

  return prisma.ordenTrabajo.findMany({
    where: buildWhereListadoOT(filtros),
    orderBy: { creadoEn: 'desc' },
    include: {
      cliente: { select: { nombre: true } },
      equipo: { select: { nombre: true } },
      tecnico: { select: { id: true, nombre: true } },
    },
  })
}
