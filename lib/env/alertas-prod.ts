/**
 * Validación de alertas AFIP / correo para producción (sin I/O de BD).
 */

import type { EnvCheck } from '@/lib/env/validar-prod'

export function smtpEnvConfigurado(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.SYSTEM_SMTP_HOST?.trim() && env.SYSTEM_SMTP_USER?.trim())
}

export function adminNotifyEmailDefinido(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ADMIN_NOTIFY_EMAIL?.trim())
}

/** Checks de env cuando hay emisor PRODUCCION activo. */
export function validarAlertasEnvProd(
  env: NodeJS.ProcessEnv,
  opts: { hayEmisorProduccion: boolean },
): EnvCheck[] {
  const checks: EnvCheck[] = []
  if (!opts.hayEmisorProduccion) return checks

  if (adminNotifyEmailDefinido(env)) {
    checks.push({
      nivel: 'ok',
      msg: 'ADMIN_NOTIFY_EMAIL definido — alertas AFIP con destinatario explícito',
    })
  } else {
    checks.push({
      nivel: 'warn',
      msg: 'ADMIN_NOTIFY_EMAIL ausente — alertas AFIP usan SUPERADMIN/GERENTE; definir explícito en producción',
    })
  }

  if (smtpEnvConfigurado(env)) {
    checks.push({ nivel: 'ok', msg: 'SYSTEM_SMTP_* configurado para envío de alertas' })
  } else {
    checks.push({
      nivel: 'warn',
      msg: 'SYSTEM_SMTP_* ausente — alertas dependen de EMAIL_IMAP conectado o quedan solo en SystemLog',
    })
  }

  return checks
}
