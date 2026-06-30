/**
 * Alertas de tickets para el icono del header (cambios de estado, esperando info).
 */
import { prisma } from '@/lib/prisma'
import { labelEstadoTicket } from '@/lib/tickets/constants'

export type AlertaTicket = {
  clave: string
  titulo: string
  mensaje: string
  href: string
  fecha: string
  leida: boolean
  prioridad: 'urgente' | 'importante' | 'info'
}

function claveAlertaHistorial(historialId: string): string {
  return `ticket-hist:${historialId}`
}

export async function alertasTicketsUsuario(usuarioId: string): Promise<AlertaTicket[]> {
  const tickets = await prisma.ticket.findMany({
    where: {
      OR: [{ solicitanteId: usuarioId }, { asignadoId: usuarioId }],
      estado: { notIn: ['CERRADA', 'CANCELADA'] },
    },
    select: {
      id: true,
      numero: true,
      titulo: true,
      estado: true,
      solicitanteId: true,
      asignadoId: true,
      historial: {
        orderBy: { creadoEn: 'desc' },
        take: 3,
        select: { id: true, estado: true, nota: true, creadoEn: true, usuarioId: true },
      },
    },
  })

  const clavesHistorial = tickets.flatMap((t) => t.historial.map((h) => claveAlertaHistorial(h.id)))
  const leidas =
    clavesHistorial.length > 0
      ? await prisma.notificacionLeida.findMany({
          where: { usuarioId, clave: { in: clavesHistorial } },
          select: { clave: true },
        })
      : []
  const leidasSet = new Set(leidas.map((l) => l.clave))

  const alertas: AlertaTicket[] = []

  for (const t of tickets) {
    const ultimoHist = t.historial[0]
    if (!ultimoHist) continue

    const esSolicitante = t.solicitanteId === usuarioId
    const esAsignado = t.asignadoId === usuarioId

    if (esSolicitante && t.estado === 'ESPERANDO_INFO') {
      const ultimaPregunta = await prisma.ticketComentario.findFirst({
        where: { ticketId: t.id, esPregunta: true, esInterno: false },
        orderBy: { creadoEn: 'desc' },
        select: { id: true, creadoEn: true, texto: true },
      })
      alertas.push({
        clave: ultimaPregunta
          ? `ticket-pregunta:${ultimaPregunta.id}`
          : `ticket-espera:${t.id}`,
        titulo: `${t.numero} — Te pidieron más info`,
        mensaje: ultimaPregunta?.texto?.slice(0, 120) ?? t.titulo,
        href: `/tickets/${t.id}`,
        fecha: (ultimaPregunta?.creadoEn ?? ultimoHist.creadoEn).toISOString(),
        leida: ultimaPregunta
          ? leidasSet.has(`ticket-pregunta:${ultimaPregunta.id}`)
          : leidasSet.has(claveAlertaHistorial(ultimoHist.id)),
        prioridad: 'urgente',
      })
      continue
    }

    if (esSolicitante && t.estado === 'RESUELTA') {
      alertas.push({
        clave: `ticket-resuelta:${t.id}`,
        titulo: `${t.numero} — Resuelta`,
        mensaje: 'Revisá la resolución y confirmá si está OK.',
        href: `/tickets/${t.id}`,
        fecha: ultimoHist.creadoEn.toISOString(),
        leida: leidasSet.has(claveAlertaHistorial(ultimoHist.id)),
        prioridad: 'importante',
      })
      continue
    }

    if (
      ultimoHist.usuarioId !== usuarioId &&
      (esSolicitante || esAsignado)
    ) {
      const clave = claveAlertaHistorial(ultimoHist.id)
      alertas.push({
        clave,
        titulo: `${t.numero} — ${labelEstadoTicket(ultimoHist.estado)}`,
        mensaje: ultimoHist.nota ?? t.titulo,
        href: `/tickets/${t.id}`,
        fecha: ultimoHist.creadoEn.toISOString(),
        leida: leidasSet.has(clave),
        prioridad: t.estado === 'ESPERANDO_INFO' ? 'urgente' : 'info',
      })
    }
  }

  return alertas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}

export async function marcarAlertasTicketLeidas(usuarioId: string, ticketId: string) {
  const historial = await prisma.ticketHistorial.findMany({
    where: { ticketId },
    select: { id: true },
  })
  if (historial.length === 0) return

  await prisma.$transaction(
    historial.map((h) =>
      prisma.notificacionLeida.upsert({
        where: { usuarioId_clave: { usuarioId, clave: claveAlertaHistorial(h.id) } },
        update: { leidaEn: new Date() },
        create: { usuarioId, clave: claveAlertaHistorial(h.id) },
      }),
    ),
  )

  await prisma.notificacionLeida.upsert({
    where: { usuarioId_clave: { usuarioId, clave: `ticket-espera:${ticketId}` } },
    update: { leidaEn: new Date() },
    create: { usuarioId, clave: `ticket-espera:${ticketId}` },
  })

  await prisma.notificacionLeida.upsert({
    where: { usuarioId_clave: { usuarioId, clave: `ticket-resuelta:${ticketId}` } },
    update: { leidaEn: new Date() },
    create: { usuarioId, clave: `ticket-resuelta:${ticketId}` },
  })

  const preguntas = await prisma.ticketComentario.findMany({
    where: { ticketId, esPregunta: true },
    select: { id: true },
  })
  for (const p of preguntas) {
    await prisma.notificacionLeida.upsert({
      where: { usuarioId_clave: { usuarioId, clave: `ticket-pregunta:${p.id}` } },
      update: { leidaEn: new Date() },
      create: { usuarioId, clave: `ticket-pregunta:${p.id}` },
    })
  }
}

export { claveAlertaHistorial }
