/**
 * Envío de correos del sistema (alertas, seguridad).
 * Usa SYSTEM_SMTP_* en .env o el canal EMAIL_IMAP conectado como fallback.
 */

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'
import type { EmailImapConfig } from '@/lib/crm/config'

export type SystemMailPayload = {
  to: string | string[]
  subject: string
  text: string
}

async function buildTransporter(): Promise<Transporter | null> {
  const host = process.env.SYSTEM_SMTP_HOST
  if (host && process.env.SYSTEM_SMTP_USER) {
    return nodemailer.createTransport({
      host,
      port: Number(process.env.SYSTEM_SMTP_PORT ?? 587),
      secure: Number(process.env.SYSTEM_SMTP_PORT) === 465,
      auth: {
        user: process.env.SYSTEM_SMTP_USER,
        pass: process.env.SYSTEM_SMTP_PASSWORD,
      },
    })
  }

  const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_IMAP' } })
  if (!canal?.activo || canal.estado !== 'CONECTADO') return null

  const c = decryptCanalConfig(canal.config) as EmailImapConfig
  if (!c.smtpHost || !c.smtpUser) return null

  return nodemailer.createTransport({
    host: c.smtpHost,
    port: Number(c.smtpPort ?? 587),
    secure: Number(c.smtpPort) === 465,
    auth: {
      user: c.smtpUser,
      pass: c.smtpPassword ?? c.imapPassword,
    },
  })
}

function fromAddress(): string {
  const name = process.env.SYSTEM_SMTP_FROM_NAME ?? 'Ingeniería Biomédica ERP'
  const email =
    process.env.SYSTEM_SMTP_FROM_EMAIL ??
    process.env.SYSTEM_SMTP_USER ??
    'noreply@ibiomedica.local'
  return `"${name}" <${email}>`
}

export async function sendSystemEmail(payload: SystemMailPayload): Promise<boolean> {
  const transporter = await buildTransporter()
  if (!transporter) {
    console.warn('[system-mail] SMTP no configurado — alerta no enviada:', payload.subject)
    return false
  }

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      subject: payload.subject,
      text: payload.text,
    })
    return true
  } catch (err) {
    console.error('[system-mail] Error al enviar:', err)
    return false
  }
}

export async function getAdminNotifyEmails(): Promise<string[]> {
  const fromEnv = process.env.ADMIN_NOTIFY_EMAIL
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromEnv?.length) return fromEnv

  const superadmins = await prisma.usuario.findMany({
    where: {
      activo: true,
      roles: { some: { rol: { clave: 'SUPERADMIN' } } },
    },
    select: { email: true },
  })
  if (superadmins.length > 0) return superadmins.map((u) => u.email)

  const gerentes = await prisma.usuario.findMany({
    where: {
      activo: true,
      roles: { some: { rol: { clave: 'GERENTE' } } },
    },
    select: { email: true },
    take: 5,
  })
  return gerentes.map((u) => u.email)
}
