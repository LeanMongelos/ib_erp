/**
 * Recordatorio de pago al cliente (cuota vencida o próxima a vencer).
 * No bloquea cron/worker; deduplicación vía SystemLog (como afip-notify).
 */

import { NivelLog } from '@prisma/client'
import { addDays, differenceInCalendarDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { registrarError } from '@/lib/error-log'
import { sendSystemEmail } from '@/lib/mail/system-mail'
import { formatFecha, formatMonto } from '@/lib/utils'

const ORIGEN = 'cobranza-cliente-email'
const PREFIX = 'cliente-recordatorio:'
const OPT_OUT_FACTURA = '[no-email-factura]'
const OPT_OUT_COBRANZA = '[no-email-cobranza]'

export type VencimientoRecordatorio = {
  id: string
  numeroCuota: number
  diasDesdeEmision: number
  fechaVencimiento: Date
  monto: number
  factura: {
    id: string
    numero: string
    total: number
    condicionPago: string | null
    clienteId: string
    cliente: { nombre: string }
  }
}

function emailClienteHabilitado(): boolean {
  const v = process.env.COBRANZA_EMAIL_CLIENTE?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'no') return false
  return true
}

function diasAnticipacionRecordatorio(): number {
  const fromEnv = Number(process.env.COBRANZA_RECORDATORIO_DIAS)
  if (Number.isFinite(fromEnv) && fromEnv >= 0) return Math.floor(fromEnv)
  return 3
}

function aplicarPlantilla(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

async function resolverDiasAnticipacionRegla(): Promise<number> {
  const regla = await prisma.reglaNotificacion.findFirst({
    where: { evento: 'cobranza.proximo', activo: true },
    select: { diasAnticipacion: true },
  })
  if (regla?.diasAnticipacion != null && regla.diasAnticipacion >= 0) {
    return regla.diasAnticipacion
  }
  return diasAnticipacionRecordatorio()
}

async function yaEnviado(vencimientoId: string, tipo: 'vencido' | 'proximo'): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: {
      origen: ORIGEN,
      mensaje: { startsWith: `${PREFIX}${vencimientoId}:${tipo}:` },
    },
    select: { id: true },
  })
  return Boolean(prev)
}

async function marcarEnviado(
  vencimientoId: string,
  tipo: 'vencido' | 'proximo',
  email: string,
): Promise<void> {
  await registrarError({
    nivel: NivelLog.INFO,
    origen: ORIGEN,
    mensaje: `${PREFIX}${vencimientoId}:${tipo}:ok`,
    metadata: { vencimientoId, tipo, email },
  })
}

async function marcarFallo(vencimientoId: string, tipo: 'vencido' | 'proximo', detalle: string): Promise<void> {
  await registrarError({
    nivel: NivelLog.WARN,
    origen: ORIGEN,
    mensaje: `${PREFIX}${vencimientoId}:${tipo}:fail`,
    metadata: { vencimientoId, tipo, detalle },
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
  if (notas.includes(OPT_OUT_FACTURA) || notas.includes(OPT_OUT_COBRANZA)) return null

  const email = cliente.email?.trim() || cliente.contactos[0]?.email?.trim() || null
  return email || null
}

function varsPlantilla(v: VencimientoRecordatorio, tipo: 'vencido' | 'proximo'): Record<string, string> {
  const diasRestantes = Math.max(0, differenceInCalendarDays(v.fechaVencimiento, new Date()))
  return {
    numero: v.factura.numero,
    cliente: v.factura.cliente.nombre,
    cuota: String(v.numeroCuota),
    monto: formatMonto(v.monto),
    total: formatMonto(v.factura.total),
    fecha: formatFecha(v.fechaVencimiento),
    condicion: v.factura.condicionPago ?? '—',
    dias: String(diasRestantes),
    situacion: tipo === 'vencido' ? 'vencida' : 'próxima a vencer',
  }
}

async function enviarRecordatorio(
  v: VencimientoRecordatorio,
  tipo: 'vencido' | 'proximo',
): Promise<boolean> {
  if (!emailClienteHabilitado()) return false
  if (await yaEnviado(v.id, tipo)) return false

  const email = await resolverEmailCliente(v.factura.clienteId)
  if (!email) return false

  const vars = varsPlantilla(v, tipo)
  const plantilla = await prisma.plantillaNotificacion.findUnique({
    where: { codigo: 'COBRANZA_RECORDATORIO' },
  })

  const subjectDefault =
    tipo === 'vencido'
      ? `Recordatorio de pago — Factura ${vars.numero} vencida`
      : `Recordatorio de pago — Factura ${vars.numero} vence el ${vars.fecha}`

  const subject =
    plantilla?.activo !== false && plantilla?.asunto
      ? aplicarPlantilla(plantilla.asunto, vars)
      : subjectDefault

  const cuerpoDefault =
    tipo === 'vencido'
      ? [
          `Estimado/a ${vars.cliente},`,
          '',
          `Le recordamos que la cuota ${vars.cuota} de la factura ${vars.numero} se encuentra vencida desde el ${vars.fecha}.`,
          `Monto de la cuota: ${vars.monto}`,
          `Total factura: ${vars.total}`,
          '',
          'Ante cualquier consulta, respondé a este correo o contactanos.',
          '',
          '— Ingeniería Biomédica',
        ].join('\n')
      : [
          `Estimado/a ${vars.cliente},`,
          '',
          `Le recordamos que la cuota ${vars.cuota} de la factura ${vars.numero} vence el ${vars.fecha} (en ${vars.dias} día(s)).`,
          `Monto de la cuota: ${vars.monto}`,
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
    await marcarEnviado(v.id, tipo, email)
    return true
  }
  await marcarFallo(v.id, tipo, 'SMTP no disponible o error de envío')
  return false
}

/** Cuota ya vencida — un recordatorio por cuota (idempotente). */
export async function notifyClienteRecordatorioVencido(v: VencimientoRecordatorio): Promise<boolean> {
  try {
    return await enviarRecordatorio(v, 'vencido')
  } catch (err) {
    await marcarFallo(v.id, 'vencido', err instanceof Error ? err.message : String(err))
    return false
  }
}

/** Cuota dentro de la ventana de anticipación — un recordatorio por cuota (idempotente). */
export async function notifyClienteRecordatorioProximo(v: VencimientoRecordatorio): Promise<boolean> {
  try {
    return await enviarRecordatorio(v, 'proximo')
  } catch (err) {
    await marcarFallo(v.id, 'proximo', err instanceof Error ? err.message : String(err))
    return false
  }
}

export async function getDiasAnticipacionCobranzaCliente(): Promise<number> {
  return resolverDiasAnticipacionRegla()
}

export async function fechaLimiteProximosRecordatorios(ahora = new Date()): Promise<Date> {
  const dias = await resolverDiasAnticipacionRegla()
  return addDays(ahora, dias)
}
