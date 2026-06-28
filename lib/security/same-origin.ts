/**
 * Protección CSRF básica para mutaciones con cookie de sesión.
 * Valida Origin/Referer contra NEXTAUTH_URL / APP_URL en producción.
 */

import { ApiError } from '@/lib/api-auth'

function allowedOrigins(): string[] {
  const raw = [process.env.NEXTAUTH_URL, process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]
    .filter(Boolean) as string[]
  const origins = new Set<string>()
  for (const u of raw) {
    try {
      origins.add(new URL(u).origin)
    } catch {
      /* ignore invalid */
    }
  }
  return [...origins]
}

export function assertSameOrigin(req: Request): void {
  if (process.env.NODE_ENV !== 'production') return

  const allowed = allowedOrigins()
  if (allowed.length === 0) return

  const origin = req.headers.get('origin')
  if (origin) {
    if (!allowed.includes(origin)) {
      throw new ApiError(403, 'Origen no permitido')
    }
    return
  }

  const referer = req.headers.get('referer')
  if (referer) {
    try {
      if (!allowed.includes(new URL(referer).origin)) {
        throw new ApiError(403, 'Origen no permitido')
      }
      return
    } catch (e) {
      if (e instanceof ApiError) throw e
      throw new ApiError(403, 'Origen no permitido')
    }
  }

  throw new ApiError(403, 'Origen no permitido')
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function isMutationMethod(method: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase())
}
