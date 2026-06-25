'use client'

import { useSession } from 'next-auth/react'

/**
 * Hook de permisos para el cliente. Devuelve true si el usuario actual tiene
 * el permiso indicado (soporta el comodín `*` del SUPERADMIN).
 *
 * La UI usa esto solo para mostrar/ocultar; la autorización real se valida
 * siempre en el backend.
 */
export function useCan(permiso: string): boolean {
  const { data } = useSession()
  const permisos = data?.user?.permissions
  if (!permisos) return false
  return permisos.includes('*') || permisos.includes(permiso)
}

export function usePermisos(): string[] {
  const { data } = useSession()
  return data?.user?.permissions ?? []
}

/** Solo el administrador del sistema (SUPERADMIN). */
export function useIsSuperAdmin(): boolean {
  const { data } = useSession()
  return (data?.user?.roles ?? []).includes('SUPERADMIN')
}
