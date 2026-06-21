/**
 * lib/page-guard.ts
 * Guarda de permisos para Server Components (páginas). Redirige a /login si no
 * hay sesión y a /dashboard si falta el permiso.
 */

import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'

export async function requirePagePermission(permiso: string) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!tienePermiso(user.permissions, permiso)) redirect('/dashboard')
  return user
}
