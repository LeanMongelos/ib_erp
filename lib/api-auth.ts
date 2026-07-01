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
import { esUsuarioAlertasDev } from '@/lib/dev/alertas-dev'

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

/** Exige al menos uno de los permisos indicados (OR lógico). */
export async function requirePermissionAny(...permisos: string[]): Promise<SessionUser> {
  return requirePermission(...permisos)
}

/** Exige rol SUPERADMIN (operaciones destructivas globales). */
export async function requireSuperAdmin(): Promise<SessionUser> {
  return requireRole('SUPERADMIN')
}

/** Alertas WARN técnicas (campana dev) — solo SUPERADMIN en DEV_ALERTS_EMAILS. */
export async function requireDevAlertas(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!esUsuarioAlertasDev({ email: user.email, roles: user.roles })) {
    throw new ApiError(403, 'No tenés permisos para realizar esta acción')
  }
  return user
}

/** Etiquetas legibles para nombres de campo frecuentes en mensajes de validación. */
const ETIQUETAS_CAMPO: Record<string, string> = {
  nombre: 'Nombre',
  descripcion: 'Descripción',
  sku: 'Código interno',
  codigoInterno: 'Código interno',
  marca: 'Marca',
  modelo: 'Modelo',
  categoria: 'Categoría',
  precioUnit: 'Precio',
  precioUnitario: 'Precio',
  stock: 'Stock',
  stockMinimo: 'Stock mínimo',
  email: 'Email',
  telefono: 'Teléfono',
  cuit: 'CUIT',
  razonSocial: 'Razón social',
  direccion: 'Dirección',
  ciudad: 'Ciudad',
  cantidad: 'Cantidad',
  fecha: 'Fecha',
}

function etiquetaCampo(path: readonly PropertyKey[]): string {
  const key = [...path].reverse().find((p) => typeof p === 'string') as string | undefined
  if (!key) return ''
  return ETIQUETAS_CAMPO[key] ?? key
}

/**
 * Resumen legible (máx. 4 campos) de los issues de Zod para mostrar al usuario,
 * nombrando el campo que falló y el motivo (evita el genérico "Datos inválidos").
 */
function resumirIssuesZod(issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 4)
    .map((i) => {
      const label = etiquetaCampo(i.path)
      return label ? `${label}: ${i.message}` : i.message
    })
    .join(' · ')
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

  // Errores de validación de Zod → 400.
  // Mostramos qué campo(s) fallaron también en producción: los mensajes de Zod
  // son de cara al usuario (no filtran datos sensibles) y evitan el genérico
  // "Datos inválidos" que no orienta. El array `details` completo va solo en dev.
  if (error instanceof ZodError) {
    const detalle = error.issues.map((i) => ({ ...i, message: traducirMensajeInterno(i.message) }))
    const resumen = resumirIssuesZod(detalle)
    const mensaje = resumen ? `Datos inválidos — ${resumen}` : 'Datos inválidos'
    if (process.env.NODE_ENV === 'production') {
      return wrap({ error: mensaje }, 400)
    }
    return wrap({ error: mensaje, details: detalle }, 400)
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
