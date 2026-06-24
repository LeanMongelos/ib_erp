/**
 * Notifica al cliente por email cuando una OT pasa a CERRADA.
 * No bloquea el cierre; deduplicación vía SystemLog; opt-out en notas del cliente.
 */

import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { registrarError } from '@/lib/error-log'
import { sendSystemEmail } from '@/lib/mail/system-mail'
import { formatFecha } from '@/lib/utils'

const ORIGEN = 'ot-cliente-email'
const PREFIX = 'cliente-ot-cerrada:'
const OPT_OUT_OT = '[no-email-ot]'
const OPT_OUT_FACTURA = '[no-email-factura]'

function emailClienteHabilitado(): boolean {
  const v = process.env.OT_EMAIL_CLIENTE?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'no') return false
  return true
}

function aplicarPlantilla(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

async function yaEnviado(otId: string): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: { origen: ORIGEN, mensaje: { startsWith: `${PREFIX}${otId}:` } },
    select: { id: true },
  })
  return Boolean(prev)
}

async function marcarEnviado(otId: string, email: string): Promise<void> {
  await registrarError({
    nivel: NivelLog.INFO,
    origen: ORIGEN,
    mensaje: `${PREFIX}${otId}:ok`,
    metadata: { otId, email },
  })
}

async function marcarFallo(otId: string, detalle: string): Promise<void> {
  await registrarError({
    nivel: NivelLog.WARN,
    origen: ORIGEN,
    mensaje: `${PREFIX}${otId}:fail`,
    metadata: { otId, detalle },
  })
}

async function resolverEmailCliente(clienteId: string): Promise<string | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      email: true,
      activo: true,
      notas: true,
      contactos: { where: { principal: true }, select: { email: true }, take: 1 },
    },
  })
  if (!cliente?.activo) return null
  const notas = cliente.notas ?? ''
  if (notas.includes(OPT_OUT_OT) || notas.includes(OPT_OUT_FACTURA)) return null

  return cliente.email?.trim() || cliente.contactos[0]?.email?.trim() || null
}

function resumenRepuestos(
  repuestos: { descripcion: string; cantidad: number }[],
): string {
  if (repuestos.length === 0) return 'Sin repuestos registrados.'
  return repuestos.map((r) => `· ${r.descripcion} × ${r.cantidad}`).join('\n')
}

/** Envía resumen al cliente tras cerrar OT. Idempotente por OT. */
export async function notifyClienteOtCerrada(otId: string): Promise<void> {
  if (!emailClienteHabilitado()) return
  if (await yaEnviado(otId)) return

  const ot = await prisma.ordenTrabajo.findUnique({
    where: { id: otId },
    select: {
      id: true,
      numero: true,
      tipo: true,
      estado: true,
      descripcion: true,
      diagnostico: true,
      fechaCierre: true,
      clienteId: true,
      cliente: { select: { nombre: true } },
      equipo: { select: { nombre: true, numeroSerie: true } },
      repuestos: { select: { descripcion: true, cantidad: true } },
    },
  })
  if (!ot || ot.estado !== 'CERRADA') return

  const email = await resolverEmailCliente(ot.clienteId)
  if (!email) return

  const equipoLabel = ot.equipo
    ? `${ot.equipo.nombre}${ot.equipo.numeroSerie ? ` (S/N ${ot.equipo.numeroSerie})` : ''}`
    : '—'

  const vars: Record<string, string> = {
    numero: ot.numero,
    cliente: ot.cliente.nombre,
    tipo: ot.tipo,
    equipo: equipoLabel,
    descripcion: ot.descripcion,
    diagnostico: ot.diagnostico?.trim() || '—',
    repuestos: resumenRepuestos(ot.repuestos),
    fecha: formatFecha(ot.fechaCierre ?? new Date()),
  }

  const plantilla = await prisma.plantillaNotificacion.findUnique({
    where: { codigo: 'OT_CERRADA' },
  })

  const subject =
    plantilla?.activo !== false && plantilla?.asunto
      ? aplicarPlantilla(plantilla.asunto, vars)
      : `Orden de trabajo ${vars.numero} finalizada — Ingeniería Biomédica`

  const cuerpoDefault = [
    `Estimado/a ${vars.cliente},`,
    '',
    `Le informamos que la orden de trabajo ${vars.numero} (${vars.tipo}) fue finalizada el ${vars.fecha}.`,
    '',
    `Equipo: ${vars.equipo}`,
    `Trabajo: ${vars.descripcion}`,
    `Diagnóstico / resolución: ${vars.diagnostico}`,
    '',
    'Repuestos utilizados:',
    vars.repuestos,
    '',
    'Ante cualquier consulta, respondé a este correo o contactanos.',
    '',
    '— Ingeniería Biomédica',
  ].join('\n')

  const text =
    plantilla?.activo !== false && plantilla?.cuerpo
      ? aplicarPlantilla(plantilla.cuerpo, vars)
      : cuerpoDefault

  const ok = await sendSystemEmail({ to: email, subject, text })
  if (ok) {
    await marcarEnviado(otId, email)
  } else {
    await marcarFallo(otId, 'SMTP no disponible o error de envío')
  }
}
