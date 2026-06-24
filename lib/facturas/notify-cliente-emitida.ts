/**
 * Envía la factura emitida (PDF) al email del cliente.
 * No bloquea la emisión AFIP; fallos se registran en SystemLog.
 */

import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { registrarError } from '@/lib/error-log'
import { sendSystemEmail } from '@/lib/mail/system-mail'
import { generarPdfFactura } from '@/lib/facturas/generar-pdf'
import { formatFecha, formatMonto } from '@/lib/utils'

const ORIGEN = 'factura-cliente-email'
const PREFIX = 'cliente-email-enviado:'
const OPT_OUT_TAG = '[no-email-factura]'

function emailClienteHabilitado(): boolean {
  const v = process.env.FACTURA_EMAIL_CLIENTE?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'no') return false
  return true
}

function aplicarPlantilla(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

async function yaEnviado(facturaId: string): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: { origen: ORIGEN, mensaje: { startsWith: `${PREFIX}${facturaId}:` } },
    select: { id: true },
  })
  return Boolean(prev)
}

async function marcarEnviado(facturaId: string, email: string): Promise<void> {
  await registrarError({
    nivel: NivelLog.INFO,
    origen: ORIGEN,
    mensaje: `${PREFIX}${facturaId}:ok`,
    metadata: { facturaId, email },
  })
}

async function marcarFallo(facturaId: string, detalle: string): Promise<void> {
  await registrarError({
    nivel: NivelLog.WARN,
    origen: ORIGEN,
    mensaje: `${PREFIX}${facturaId}:fail`,
    metadata: { facturaId, detalle },
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
  if (cliente.notas?.includes(OPT_OUT_TAG)) return null

  const email =
    cliente.email?.trim() ||
    cliente.contactos[0]?.email?.trim() ||
    null
  return email || null
}

/** Envía PDF al cliente tras emisión exitosa. Idempotente por factura. */
export async function notifyClienteFacturaEmitida(facturaId: string): Promise<void> {
  if (!emailClienteHabilitado()) return
  if (await yaEnviado(facturaId)) return

  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: {
      id: true,
      numero: true,
      numeroAfip: true,
      tipo: true,
      total: true,
      cae: true,
      fechaEmision: true,
      estado: true,
      clienteId: true,
      cliente: { select: { nombre: true } },
      emisor: { select: { razonSocial: true } },
    },
  })
  if (!factura || factura.estado !== 'EMITIDA') return

  const email = await resolverEmailCliente(factura.clienteId)
  if (!email) return

  const numeroDisplay = factura.numeroAfip
    ? `${factura.tipo} ${String(factura.numeroAfip).padStart(8, '0')}`
    : `${factura.tipo} ${factura.numero}`

  const vars: Record<string, string> = {
    numero: numeroDisplay,
    cliente: factura.cliente.nombre,
    cae: factura.cae ?? '—',
    total: formatMonto(factura.total),
    fecha: formatFecha(factura.fechaEmision),
    emisor: factura.emisor?.razonSocial ?? 'Ingeniería Biomédica',
  }

  const plantilla = await prisma.plantillaNotificacion.findUnique({
    where: { codigo: 'FACTURA_EMITIDA' },
  })

  const subject = plantilla?.activo !== false && plantilla?.asunto
    ? aplicarPlantilla(plantilla.asunto, vars)
    : `Comprobante ${numeroDisplay} — ${vars.emisor}`

  const cuerpoDefault = [
    `Estimado/a ${factura.cliente.nombre},`,
    '',
    `Adjuntamos el comprobante fiscal ${numeroDisplay} emitido el ${vars.fecha}.`,
    `CAE: ${vars.cae}`,
    `Importe total: ${vars.total}`,
    '',
    'Ante cualquier consulta, respondé a este correo o contactanos.',
    '',
    '— Ingeniería Biomédica',
  ].join('\n')

  const text =
    plantilla?.activo !== false && plantilla?.cuerpo
      ? aplicarPlantilla(plantilla.cuerpo, vars)
      : cuerpoDefault

  const pdf = await generarPdfFactura(facturaId)
  if (!pdf) {
    await marcarFallo(facturaId, 'No se pudo generar el PDF')
    return
  }

  const filename = `factura-${factura.numero.replace(/\//g, '-')}.pdf`
  const ok = await sendSystemEmail({
    to: email,
    subject,
    text,
    attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
  })

  if (ok) {
    await marcarEnviado(facturaId, email)
  } else {
    await marcarFallo(facturaId, 'SMTP no disponible o error de envío')
  }
}
