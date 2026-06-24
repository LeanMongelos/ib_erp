/**
 * UI/API de alertas técnicas (WARN SystemLog) — solo desarrollador / operador del ERP.
 * No confundir con la campana de notificaciones operativas del negocio.
 */

const DEFAULT_DEV_EMAILS = ['admin@ib.com']

export function emailsAlertasDev(): string[] {
  const raw = process.env.DEV_ALERTS_EMAILS?.trim()
  if (raw) {
    return raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  }
  return DEFAULT_DEV_EMAILS
}

export function esUsuarioAlertasDev(input: {
  email?: string | null
  roles?: string[] | null
}): boolean {
  const email = input.email?.trim().toLowerCase()
  if (!email) return false
  const roles = input.roles ?? []
  if (!roles.includes('SUPERADMIN')) return false
  return emailsAlertasDev().includes(email)
}
