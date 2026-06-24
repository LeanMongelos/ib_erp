/**
 * Envía presupuesto (PDF) al cliente cuando pasa a ENVIADO.
 * No bloquea la transición; deduplicación vía SystemLog; opt-out en notas del cliente.
 */

import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { registrarError } from '@/lib/error-log'
import { sendSystemEmail } from '@/lib/mail/system-mail'
import { generarPdfPresupuesto } from '@/lib/presupuestos/generar-pdf'
import { formatFecha, formatMonto } from '@/lib/utils'

const ORIGEN = 'presupuesto-cliente-email'
const PREFIX = 'cliente-presupuesto-enviado:'
const OPT_OUT_PRESUPUESTO = '[no-email-presupuesto]'
const OPT_OUT_FACTURA = '[no-email-factura]'

function emailClienteHabilitado(): boolean {
  const v = process.env.PRESUPUESTO_EMAIL_CLIENTE?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'no') return false
  return true
}

function aplicarPlantilla(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

async function yaEnviado(presupuestoId: string): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: { origen: ORIGEN, mensaje: { startsWith: `${PREFIX}${presupuestoId}:` } },
    select: { id: true },
  })
  return Boolean(prev)
}

async function marcarEnviado(presupuestoId: string, email: string): Promise<void> {
  await registrarError({
    nivel: NivelLog.INFO,
    origen: ORIGEN,
    mensaje: `${PREFIX}${presupuestoId}:ok`,
    metadata: { presupuestoId, email },
  })
}

async function marcarFallo(presupuestoId: string, detalle: string): Promise<void> {
  await registrarError({
    nivel: NivelLog.WARN,
    origen: ORIGEN,
    mensaje: `${PREFIX}${presupuestoId}:fail`,
    metadata: { presupuestoId, detalle },
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
  if (notas.includes(OPT_OUT_PRESUPUESTO) || notas.includes(OPT_OUT_FACTURA)) return null

  return cliente.email?.trim() || cliente.contactos[0]?.email?.trim() || null
}

/** Envía PDF al cliente tras marcar presupuesto ENVIADO. Idempotente por presupuesto. */
export async function notifyClientePresupuestoEnviado(presupuestoId: string): Promise<void> {
  if (!emailClienteHabilitado()) return
  if (await yaEnviado(presupuestoId)) return

  const pres = await prisma.presupuesto.findUnique({
    where: { id: presupuestoId },
    select: {
      id: true,
      numero: true,
      total: true,
      estado: true,
      fechaVencimiento: true,
      clienteId: true,
      cliente: { select: { nombre: true } },
      emisor: { select: { razonSocial: true } },
    },
  })
  if (!pres || pres.estado !== 'ENVIADO') return

  const email = await resolverEmailCliente(pres.clienteId)
  if (!email) return

  const vars: Record<string, string> = {
    numero: pres.numero,
    cliente: pres.cliente.nombre,
    total: formatMonto(pres.total),
    vencimiento: pres.fechaVencimiento ? formatFecha(pres.fechaVencimiento) : '—',
    emisor: pres.emisor?.razonSocial ?? 'Ingeniería Biomédica',
  }

  const plantilla = await prisma.plantillaNotificacion.findUnique({
    where: { codigo: 'PRESUPUESTO_ENVIADO' },
  })

  const subject =
    plantilla?.activo !== false && plantilla?.asunto
      ? aplicarPlantilla(plantilla.asunto, vars)
      : `Presupuesto ${vars.numero} — ${vars.emisor}`

  const cuerpoDefault = [
    `Estimado/a ${vars.cliente},`,
    '',
    `Adjuntamos el presupuesto ${vars.numero}.`,
    `Importe total: ${vars.total}`,
    pres.fechaVencimiento ? `Válido hasta: ${vars.vencimiento}` : '',
    '',
    'Ante cualquier consulta, respondé a este correo o contactanos.',
    '',
    '— Ingeniería Biomédica',
  ]
    .filter(Boolean)
    .join('\n')

  const text =
    plantilla?.activo !== false && plantilla?.cuerpo
      ? aplicarPlantilla(plantilla.cuerpo, vars)
      : cuerpoDefault

  const pdf = await generarPdfPresupuesto(presupuestoId)
  if (!pdf) {
    await marcarFallo(presupuestoId, 'No se pudo generar el PDF')
    return
  }

  const filename = `presupuesto-${pres.numero.replace(/\//g, '-')}.pdf`
  const ok = await sendSystemEmail({
    to: email,
    subject,
    text,
    attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
  })

  if (ok) {
    await marcarEnviado(presupuestoId, email)
  } else {
    await marcarFallo(presupuestoId, 'SMTP no disponible o error de envío')
  }
}
