/**
 * Feedback bidireccional: pedir info y registrar respuestas del solicitante.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tienePermiso } from '@/lib/rbac'
import { validarTransicionTicket } from '@/lib/tickets/transiciones'
import type { EstadoTicket } from '@prisma/client'

type Actor = { id: string; permissions: string[] }

export async function registrarComentarioConFeedback(
  ticketId: string,
  actor: Actor,
  data: { texto: string; esInterno: boolean; esPregunta: boolean },
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, estado: true, solicitanteId: true, asignadoId: true, numero: true },
  })
  if (!ticket) return null

  const esAdmin = tienePermiso(actor.permissions, 'tickets.assign')
  const esSolicitante = ticket.solicitanteId === actor.id

  if (data.esPregunta && !esAdmin) {
    throw new Error('Solo quien gestiona el ticket puede pedir más información')
  }
  if (data.esPregunta && data.esInterno) {
    throw new Error('Una pregunta al solicitante no puede ser comentario interno')
  }

  let nuevoEstado: EstadoTicket | null = null
  let notaHistorial: string | null = null

  if (data.esPregunta && esAdmin) {
    nuevoEstado = 'ESPERANDO_INFO'
    notaHistorial = `Se pidió más información: ${data.texto.slice(0, 120)}`
  } else if (
    esSolicitante &&
    ticket.estado === 'ESPERANDO_INFO' &&
    !data.esInterno &&
    !data.esPregunta
  ) {
    nuevoEstado = 'EN_PROGRESO'
    notaHistorial = 'El solicitante respondió con más información'
  }

  if (nuevoEstado) {
    const err = validarTransicionTicket(ticket.estado, nuevoEstado)
    if (err) {
      nuevoEstado = null
      notaHistorial = null
    }
  }

  const updateTicket: Prisma.TicketUpdateInput = {}
  if (nuevoEstado) {
    updateTicket.estado = nuevoEstado
    updateTicket.historial = {
      create: {
        estado: nuevoEstado,
        nota: notaHistorial,
        usuarioId: actor.id,
      },
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    if (Object.keys(updateTicket).length > 0) {
      await tx.ticket.update({ where: { id: ticketId }, data: updateTicket })
    }

    return tx.ticketComentario.create({
      data: {
        ticketId,
        usuarioId: actor.id,
        texto: data.texto,
        esInterno: data.esInterno,
        esPregunta: data.esPregunta,
      },
      include: { usuario: { select: { id: true, nombre: true } } },
    })
  })

  return result
}
