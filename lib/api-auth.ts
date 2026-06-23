/**
 * lib/api-auth.ts
 * Utilidades de autenticación, autorización y manejo de errores para los
 * route handlers de la API.
 *
 * Centraliza:
 * - Obtención del usuario de la sesión (`getSessionUser`)
 * - Exigir sesión válida (`requireAuth`) → 401 si no hay sesión
 * - Exigir un rol determinado (`requireRole`) → 403 si no tiene permisos
 * - Conversión uniforme de errores a respuestas JSON (`handleApiError`),
 *   incluyendo errores de Zod y de Prisma (clave única, FK, no encontrado).
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { getAuthOptions } from '@/lib/auth'
import { tienePermiso } from '@/lib/rbac'
import { applySecurityHeaders } from '@/lib/security/headers'
import { traducirMensajeInterno } from '@/lib/errores'
import { persistirErrorApi, type ApiErrorLogContext } from '@/lib/error-log'

export interface SessionUser {
  id: string
  role: string
  roles: string[]
  permissions: string[]
  name?: string | null
  email?: string | null
}

/**
 * Error de API con código HTTP asociado. Se lanza dentro de los handlers
 * y `handleApiError` lo convierte en la respuesta JSON correspondiente.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Devuelve el usuario de la sesión actual, o `null` si no hay sesión. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(await getAuthOptions())
  if (!session?.user) return null
  return session.user as SessionUser
}

/** Exige una sesión válida. Lanza `ApiError(401)` si no la hay. */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, 'No autorizado')
  return user
}

/**
 * Exige que el usuario autenticado tenga al menos uno de los roles indicados.
 * Lanza `ApiError(401)` si no hay sesión y `ApiError(403)` si el rol no alcanza.
 */
export async function requireRole(...roles: string[]): Promise<SessionUser> {
  const user = await requireAuth()
  const tiene = roles.some((r) => (user.roles ?? []).includes(r))
  if (!tiene) {
    throw new ApiError(403, 'No tenés permisos para realizar esta acción')
  }
  return user
}

/**
 * Exige que el usuario tenga al menos uno de los permisos indicados (RBAC).
 * Es la forma preferida de autorizar acciones en la API.
 */
export async function requirePermission(...permisos: string[]): Promise<SessionUser> {
  const user = await requireAuth()
  const tiene = permisos.some((p) => tienePermiso(user.permissions, p))
  if (!tiene) {
    throw new ApiError(403, 'No tenés permisos para realizar esta acción')
  }
  return user
}

/**
 * Convierte cualquier error lanzado dentro de un handler en una respuesta
 * JSON consistente. Mapea los casos conocidos a códigos HTTP adecuados.
 */
export function handleApiError(error: unknown, ctx?: ApiErrorLogContext): NextResponse {
  const wrap = (body: object, status: number) =>
    applySecurityHeaders(NextResponse.json(body, { status })) as NextResponse

  // Errores de autorización/lógica propios
  if (error instanceof ApiError) {
    return wrap({ error: error.message }, error.status)
  }

  // Errores de validación de Zod → 400 (sin detalle interno en producción)
  if (error instanceof ZodError) {
    const detalle = error.issues.map((i) => ({ ...i, message: traducirMensajeInterno(i.message) }))
    if (process.env.NODE_ENV === 'production') {
      return wrap({ error: 'Datos inválidos' }, 400)
    }
    return wrap({ error: 'Datos inválidos', details: detalle }, 400)
  }

  // Errores conocidos de Prisma
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return wrap({ error: 'Ya existe un registro con ese valor único' }, 409)
      case 'P2003':
        return wrap({ error: 'Referencia inválida: el registro relacionado no existe' }, 400)
      case 'P2025':
        return wrap({ error: 'Registro no encontrado' }, 404)
    }
  }

  console.error('[API] Error no controlado:', error)
  void (async () => {
    const user = ctx?.usuarioId !== undefined ? null : await getSessionUser()
    persistirErrorApi(error, {
      ...ctx,
      usuarioId: ctx?.usuarioId ?? user?.id ?? null,
    })
  })()
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''
  const message = traducirMensajeInterno(
    process.env.NODE_ENV === 'production' || !raw.trim()
      ? 'Error interno del servidor'
      : raw,
  )
  return wrap({ error: message }, 500)
}
