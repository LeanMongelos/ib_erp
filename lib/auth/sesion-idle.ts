/** Tiempo máximo de inactividad antes de pedir login de nuevo. */
export const DEFAULT_SESION_MAX_HORAS = 5

/** Cada cuántos segundos se renueva el JWT mientras hay actividad. */
export const SESION_UPDATE_AGE_SEC = 60

export function sesionMaxSecDesdeHoras(horas: number): number {
  return horas * 3600
}

export type TokenCamposIdle = {
  id?: string
  iat?: number
  lastActivity?: number
  sessionMaxSec?: number
}

export function sesionIdleExpirada(token: TokenCamposIdle | null | undefined): boolean {
  if (!token?.id) return false
  const now = Math.floor(Date.now() / 1000)
  const last = token.lastActivity ?? token.iat ?? now
  const maxSec = token.sessionMaxSec ?? sesionMaxSecDesdeHoras(DEFAULT_SESION_MAX_HORAS)
  return now - last > maxSec
}

/** Limpia claims de usuario en el JWT (sesión inválida). */
export function invalidarClaimsSesion(token: Record<string, unknown>) {
  delete token.id
  delete token.sub
  delete token.role
  delete token.roles
  delete token.permissions
  delete token.avatarUrl
  delete token.exigirCambioPassword
  delete token.lastActivity
}
