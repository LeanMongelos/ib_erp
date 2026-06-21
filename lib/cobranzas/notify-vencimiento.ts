import { prisma } from '@/lib/prisma'
import { sendSystemEmail } from '@/lib/mail/system-mail'
import { formatFecha, formatMonto } from '@/lib/utils'

const DEFAULT_COBRANZA_EMAILS = ['guillermo@ibiomedica.com', 'lucas@ibiomedica.com']

export async function getCobranzaNotifyEmails(): Promise<string[]> {
  const fromEnv = process.env.COBRANZA_NOTIFY_EMAIL
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromEnv?.length) return fromEnv

  const users = await prisma.usuario.findMany({
    where: { activo: true, email: { in: DEFAULT_COBRANZA_EMAILS } },
    select: { email: true },
  })
  if (users.length > 0) return users.map((u) => u.email)
  return DEFAULT_COBRANZA_EMAILS
}

type VencimientoConFactura = {
  id: string
  numeroCuota: number
  diasDesdeEmision: number
  fechaVencimiento: Date
  monto: number
  factura: {
    numero: string
    total: number
    condicionPago: string | null
    cliente: { nombre: string }
  }
}

export async function enviarAvisoVencimiento(v: VencimientoConFactura): Promise<boolean> {
  const destinatarios = await getCobranzaNotifyEmails()
  const { factura } = v
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const subject = `[Cobranza] Vencimiento día ${v.diasDesdeEmision} — Factura ${factura.numero}`
  const text = [
    'Hay que cobrar: llegó el plazo de cobranza programado.',
    '',
    `Factura: ${factura.numero}`,
    `Cliente: ${factura.cliente.nombre}`,
    `Cuota: ${v.numeroCuota} (día ${v.diasDesdeEmision} desde emisión)`,
    `Monto de la cuota: ${formatMonto(v.monto)}`,
    `Total factura: ${formatMonto(factura.total)}`,
    `Condición de pago: ${factura.condicionPago ?? '—'}`,
    `Fecha de vencimiento: ${formatFecha(v.fechaVencimiento)}`,
    '',
    `Ver facturación: ${appUrl}/facturacion`,
    `Registrar cobro: ${appUrl}/cobranzas`,
    '',
    '— Ingeniería Biomédica ERP',
  ].join('\n')

  return sendSystemEmail({ to: destinatarios, subject, text })
}
