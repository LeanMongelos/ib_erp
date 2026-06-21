import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { sendSystemEmail, getAdminNotifyEmails } from '@/lib/mail/system-mail'
import { LOGIN_LOCKOUT_MINUTES, LOGIN_MAX_ATTEMPTS } from '@/lib/auth/login-rate-limit'

export type LoginLockNotifyInput = {
  email: string
  ip: string
  reason: 'account' | 'ip'
  retryAfterMinutes: number
  usuarioNombre?: string | null
}

export async function notifyAdminLoginLockout(input: LoginLockNotifyInput): Promise<void> {
  const recipients = await getAdminNotifyEmails()
  if (recipients.length === 0) {
    console.warn('[login-lock-notify] Sin destinatarios ADMIN_NOTIFY_EMAIL ni SUPERADMIN')
    return
  }

  const cuando = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const titulo =
    input.reason === 'account'
      ? `Bloqueo de login — ${LOGIN_MAX_ATTEMPTS} intentos fallidos`
      : 'Bloqueo de login — límite por IP superado'

  const cuerpo =
    input.reason === 'account'
      ? [
          'Se bloqueó temporalmente un intento de acceso al ERP por exceso de contraseñas incorrectas.',
          '',
          `Cuenta intentada: ${input.email}`,
          input.usuarioNombre ? `Usuario en sistema: ${input.usuarioNombre}` : 'Usuario en sistema: (no registrado o email distinto)',
          `IP origen: ${input.ip}`,
          `Duración del bloqueo: ${input.retryAfterMinutes || LOGIN_LOCKOUT_MINUTES} minutos`,
          `Fecha/hora: ${cuando}`,
          '',
          'Si fue un error del equipo, esperá a que expire el bloqueo o contactá al administrador.',
          `Panel: ${baseUrl}/configuracion`,
        ].join('\n')
      : [
          'Se detectó actividad sospechosa: demasiados intentos de login fallidos desde una misma IP.',
          '',
          `IP origen: ${input.ip}`,
          `Último email intentado: ${input.email}`,
          `Ventana de bloqueo IP: ${input.retryAfterMinutes} minutos restantes`,
          `Fecha/hora: ${cuando}`,
          '',
          'Revisá los logs de auditoría si el patrón continúa.',
          `Panel: ${baseUrl}/configuracion`,
        ].join('\n')

  await sendSystemEmail({
    to: recipients,
    subject: `[iBiomédica] ${titulo}`,
    text: cuerpo,
  })
}
