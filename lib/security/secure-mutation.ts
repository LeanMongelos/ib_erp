/**
 * Helpers para mutaciones API autenticadas por cookie (CSRF + body limit + permiso).
 */

import type { SessionUser } from '@/lib/api-auth'
import { requirePermission, requirePermissionAny } from '@/lib/api-auth'
import { assertSameOrigin, isMutationMethod } from '@/lib/security/same-origin'
import { assertBodySize } from '@/lib/security/body-limit'

export function assertSecureRequest(req: Request): void {
  if (isMutationMethod(req.method)) {
    assertBodySize(req)
    assertSameOrigin(req)
  }
}

export async function requireSecureMutation(
  req: Request,
  ...permisos: string[]
): Promise<SessionUser> {
  if (isMutationMethod(req.method)) {
    assertBodySize(req)
    assertSameOrigin(req)
  }
  return requirePermission(...permisos)
}

export async function requireSecureMutationAny(
  req: Request,
  ...permisos: string[]
): Promise<SessionUser> {
  if (isMutationMethod(req.method)) {
    assertBodySize(req)
    assertSameOrigin(req)
  }
  return requirePermissionAny(...permisos)
}
