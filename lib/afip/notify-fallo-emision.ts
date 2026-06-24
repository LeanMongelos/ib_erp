/**
 * Alertas admin por rechazo AFIP o fallo permanente del worker.
 * Una notificación por factura (deduplicación vía SystemLog).
 */

import { NivelLog } from '@prisma/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import { registrarError } from '@/lib/error-log'
import { sendSystemEmail, getAdminNotifyEmails } from '@/lib/mail/system-mail'

const ORIGEN = 'afip-notify'
const PREFIX = 'rechazo-notificado:'

async function yaNotificado(facturaId: string): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: {
      origen: ORIGEN,
      mensaje: { startsWith: `${PREFIX}${facturaId}:` },
    },
    select: { id: true },
  })
  return Boolean(prev)
}

async function marcarNotificado(
  facturaId: string,
  tipo: 'rechazo' | 'worker_fail',
  metadata?: Record<string, unknown>,
): Promise<void> {
  await registrarError({
    nivel: NivelLog.INFO,
    origen: ORIGEN,
    mensaje: `${PREFIX}${facturaId}:${tipo}`,
    metadata: { facturaId, tipo, ...metadata },
  })
}

export type NotifyAfipFalloInput = {
  facturaId: string
  observaciones?: string | null
  usuarioId?: string | null
  origenFallo?: 'emision' | 'worker'
}

/** Notifica admins una sola vez por factura rechazada o fallo permanente AFIP. */
export async function notifyAfipFalloEmision(input: NotifyAfipFalloInput): Promise<void> {
  const { facturaId, observaciones, usuarioId, origenFallo = 'emision' } = input

  if (await yaNotificado(facturaId)) return

  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: {
      numero: true,
      tipo: true,
      total: true,
      estado: true,
      afipObservaciones: true,
      cliente: { select: { nombre: true } },
      emisor: { select: { razonSocial: true, ambiente: true } },
    },
  })

  const obs = observaciones ?? factura?.afipObservaciones ?? 'Sin detalle AFIP'
  const cuando = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const titulo =
    origenFallo === 'worker'
      ? 'Fallo permanente worker AFIP'
      : 'Factura rechazada por AFIP'

  const lineas = [
    origenFallo === 'worker'
      ? 'El worker AFIP agotó reintentos al procesar una emisión.'
      : 'AFIP rechazó la emisión de un comprobante fiscal.',
    '',
    factura
      ? `Comprobante: ${factura.tipo} ${factura.numero ?? facturaId.slice(0, 8)}`
      : `Factura ID: ${facturaId}`,
    factura?.cliente ? `Cliente: ${factura.cliente.nombre}` : null,
    factura?.emisor
      ? `Emisor: ${factura.emisor.razonSocial} (${factura.emisor.ambiente})`
      : null,
    factura ? `Estado: ${factura.estado}` : null,
    `Observaciones: ${obs}`,
    `Fecha/hora: ${cuando}`,
    '',
    `Revisar en Facturación o Logs (origen worker-afip / afip-notify).`,
    `${baseUrl}/facturacion`,
  ].filter(Boolean) as string[]

  await marcarNotificado(facturaId, origenFallo === 'worker' ? 'worker_fail' : 'rechazo', {
    observaciones: obs,
    usuarioId,
  })

  const recipients = await getAdminNotifyEmails()
  if (recipients.length === 0) {
    console.warn('[afip-notify] Sin destinatarios — alerta registrada en SystemLog solamente')
    return
  }

  await sendSystemEmail({
    to: recipients,
    subject: `[iBiomédica] ${titulo}`,
    text: lineas.join('\n'),
  })
}
