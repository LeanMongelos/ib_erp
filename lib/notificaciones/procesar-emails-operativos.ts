/**
 * Emails operativos ligados a reglas de notificación (inbox).
 * Dedup diaria por entidad vía SystemLog (mismo patrón que stock-minimo).
 */

import { addDays, format } from 'date-fns'
import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { registrarError } from '@/lib/error-log'
import { sendSystemEmail, getAdminNotifyEmails } from '@/lib/mail/system-mail'
import { formatFechaHora } from '@/lib/utils'

const ORIGEN_OT = 'notif-ot-sla'
const ORIGEN_PREV = 'notif-preventivo'
const PREFIX_OT = 'ot-sla-email:'
const PREFIX_PREV = 'preventivo-email:'

async function reglaActiva(evento: string): Promise<{ activo: boolean; dias: number }> {
  const regla = await prisma.reglaNotificacion.findFirst({ where: { evento, activo: true } })
  if (!regla) return { activo: false, dias: 1 }
  return { activo: true, dias: regla.diasAnticipacion ?? 1 }
}

function claveDia(prefix: string, id: string, dia = new Date()): string {
  return `${prefix}${id}:${format(dia, 'yyyy-MM-dd')}`
}

async function yaEnviadoHoy(origen: string, mensajePrefix: string): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: { origen, mensaje: { startsWith: mensajePrefix } },
    select: { id: true },
  })
  return Boolean(prev)
}

async function marcarEnviado(origen: string, clave: string, metadata: Record<string, unknown>): Promise<void> {
  await registrarError({
    nivel: NivelLog.INFO,
    origen,
    mensaje: `${clave}:ok`,
    metadata,
  })
}

async function destinatariosOperativos(): Promise<string[]> {
  const fromEnv = process.env.OPERATIVO_NOTIFY_EMAIL
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromEnv?.length) return fromEnv
  return getAdminNotifyEmails()
}

export type ResultadoEmailsOperativos = {
  otRevisadas: number
  otEnviadas: number
  preventivoRevisados: number
  preventivoEnviados: number
}

export async function procesarEmailsOtSlaProximo(): Promise<{ revisadas: number; enviadas: number }> {
  const { activo, dias } = await reglaActiva('ot.sla_proximo')
  if (!activo) return { revisadas: 0, enviadas: 0 }

  const destinatarios = await destinatariosOperativos()
  if (destinatarios.length === 0) return { revisadas: 0, enviadas: 0 }

  const ahora = new Date()
  const limite = addDays(ahora, Math.max(dias, 1))
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const ots = await prisma.ordenTrabajo.findMany({
    where: {
      estado: { in: ['ABIERTA', 'EN_PROCESO'] },
      slaVence: { gte: ahora, lte: limite },
    },
    include: {
      cliente: { select: { nombre: true } },
      tecnico: { select: { nombre: true } },
    },
    take: 30,
    orderBy: { slaVence: 'asc' },
  })

  let enviadas = 0
  for (const ot of ots) {
    const clave = claveDia(PREFIX_OT, ot.id)
    if (await yaEnviadoHoy(ORIGEN_OT, clave)) continue

    const subject = `[OT] SLA por vencer — ${ot.numero}`
    const text = [
      'Una orden de trabajo está cerca del límite de SLA.',
      '',
      `OT: ${ot.numero}`,
      `Cliente: ${ot.cliente.nombre}`,
      `Técnico: ${ot.tecnico?.nombre ?? 'Sin asignar'}`,
      `SLA vence: ${formatFechaHora(ot.slaVence)}`,
      '',
      `Ver OT: ${appUrl}/servicio-tecnico/${ot.id}`,
      '',
      '— Ingeniería Biomédica ERP',
    ].join('\n')

    const ok = await sendSystemEmail({ to: destinatarios, subject, text })
    if (ok) {
      await marcarEnviado(ORIGEN_OT, clave, { otId: ot.id })
      enviadas++
    }
  }

  return { revisadas: ots.length, enviadas }
}

export async function procesarEmailsPreventivoProximo(): Promise<{ revisados: number; enviados: number }> {
  const { activo, dias } = await reglaActiva('preventivo.proximo')
  if (!activo) return { revisados: 0, enviados: 0 }

  const destinatarios = await destinatariosOperativos()
  if (destinatarios.length === 0) return { revisados: 0, enviados: 0 }

  const ahora = new Date()
  const limite = addDays(ahora, Math.max(dias, 7))
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const planes = await prisma.planMantenimiento.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'PROGRAMADO'] },
      proximoServicio: { gte: ahora, lte: limite },
    },
    include: {
      equipo: { include: { cliente: { select: { nombre: true } } } },
    },
    take: 30,
    orderBy: { proximoServicio: 'asc' },
  })

  let enviados = 0
  for (const p of planes) {
    if (!p.proximoServicio) continue
    const clave = claveDia(PREFIX_PREV, p.id)
    if (await yaEnviadoHoy(ORIGEN_PREV, clave)) continue

    const subject = `[Preventivo] Próximo servicio — ${p.equipo.nombre}`
    const text = [
      'Hay un mantenimiento preventivo programado en los próximos días.',
      '',
      `Equipo: ${p.equipo.nombre}`,
      `Cliente: ${p.equipo.cliente?.nombre ?? '—'}`,
      `Descripción: ${p.descripcion}`,
      `Próximo servicio: ${formatFechaHora(p.proximoServicio)}`,
      '',
      `Ver preventivos: ${appUrl}/servicio-tecnico/preventivo`,
      '',
      '— Ingeniería Biomédica ERP',
    ].join('\n')

    const ok = await sendSystemEmail({ to: destinatarios, subject, text })
    if (ok) {
      await marcarEnviado(ORIGEN_PREV, clave, { planId: p.id })
      enviados++
    }
  }

  return { revisados: planes.length, enviados }
}

export async function procesarEmailsOperativosInbox(): Promise<ResultadoEmailsOperativos> {
  const ot = await procesarEmailsOtSlaProximo()
  const prev = await procesarEmailsPreventivoProximo()
  return {
    otRevisadas: ot.revisadas,
    otEnviadas: ot.enviadas,
    preventivoRevisados: prev.revisados,
    preventivoEnviados: prev.enviados,
  }
}
