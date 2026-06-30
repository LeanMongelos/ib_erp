import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tienePermiso } from '@/lib/rbac'
import { crearConNumeroUnico, siguienteNumeroTicket } from '@/lib/sequences'
import type { ticketCreateSchema } from '@/lib/validation'
import type { z } from 'zod'

const ticketIncludeList = {
  solicitante: { select: { id: true, nombre: true, email: true } },
  asignado: { select: { id: true, nombre: true, email: true } },
} satisfies Prisma.TicketInclude

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>

export async function crearTicket(
  data: TicketCreateInput,
  opts: { solicitanteId: string },
) {
  return crearConNumeroUnico(siguienteNumeroTicket, (numero) =>
    prisma.ticket.create({
      data: {
        numero,
        titulo: data.titulo,
        descripcion: data.descripcion,
        tipo: data.tipo,
        areaOrigen: data.areaOrigen,
        areaDestino: data.areaDestino ?? 'DESARROLLO',
        prioridad: data.prioridad ?? 'NORMAL',
        solicitanteId: opts.solicitanteId,
        entidadTipo: data.entidadTipo ?? null,
        entidadId: data.entidadId ?? null,
        historial: {
          create: {
            estado: 'ABIERTA',
            nota: 'Solicitud creada',
            usuarioId: opts.solicitanteId,
          },
        },
      },
      include: ticketIncludeList,
    }),
  )
}

export type ListarTicketsParams = {
  q?: string | null
  estado?: string | null
  tipo?: string | null
  area?: string | null
  asignadoId?: string | null
  soloMios?: boolean
  usuarioId: string
  permisos: string[]
}

export async function listarTickets(params: ListarTicketsParams) {
  const verTodos = tienePermiso(params.permisos, 'tickets.read_all')
  const where: Prisma.TicketWhereInput = {}

  if (!verTodos || params.soloMios) {
    where.OR = [
      { solicitanteId: params.usuarioId },
      { asignadoId: params.usuarioId },
    ]
  }

  const q = params.q?.trim()
  if (q) {
    const busqueda: Prisma.TicketWhereInput = {
      OR: [
        { numero: { contains: q, mode: 'insensitive' } },
        { titulo: { contains: q, mode: 'insensitive' } },
        { descripcion: { contains: q, mode: 'insensitive' } },
      ],
    }
    if (where.OR) {
      where.AND = [{ OR: where.OR }, busqueda]
      delete where.OR
    } else {
      Object.assign(where, busqueda)
    }
  }

  if (params.estado && params.estado !== 'TODOS') {
    where.estado = params.estado as Prisma.EnumEstadoTicketFilter['equals']
  }
  if (params.tipo && params.tipo !== 'TODOS') {
    where.tipo = params.tipo as Prisma.EnumTipoTicketFilter['equals']
  }
  if (params.area && params.area !== 'TODOS') {
    where.areaOrigen = params.area as Prisma.EnumAreaTicketFilter['equals']
  }
  if (params.asignadoId && params.asignadoId !== 'TODOS') {
    if (params.asignadoId === 'SIN_ASIGNAR') {
      where.asignadoId = null
    } else {
      where.asignadoId = params.asignadoId
    }
  }

  return prisma.ticket.findMany({
    where,
    include: ticketIncludeList,
    orderBy: [{ prioridad: 'desc' }, { creadoEn: 'desc' }],
    take: 200,
  })
}

export async function obtenerTicketDetalle(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      solicitante: { select: { id: true, nombre: true, email: true } },
      asignado: { select: { id: true, nombre: true, email: true } },
      comentarios: {
        orderBy: { creadoEn: 'asc' },
        include: { usuario: { select: { id: true, nombre: true } } },
      },
      historial: {
        orderBy: { creadoEn: 'asc' },
        include: { usuario: { select: { id: true, nombre: true } } },
      },
    },
  })
}

export function puedeVerTicket(
  ticket: { solicitanteId: string; asignadoId: string | null },
  usuarioId: string,
  permisos: string[],
): boolean {
  if (tienePermiso(permisos, 'tickets.read_all')) return true
  return ticket.solicitanteId === usuarioId || ticket.asignadoId === usuarioId
}

export { ticketIncludeList }
