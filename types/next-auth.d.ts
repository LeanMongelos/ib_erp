/**
 * types/next-auth.d.ts
 * Augmenta los tipos de NextAuth para exponer `id`, `role` (rol principal),
 * `roles`, `permissions` (RBAC) y `avatarUrl` en la sesión y el JWT.
 */

import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      roles: string[]
      permissions: string[]
      avatarUrl: string | null
      exigirCambioPassword: boolean
    } & DefaultSession['user']
  }

  interface User {
    role: string
    roles?: string[]
    permissions?: string[]
    avatarUrl?: string | null
    exigirCambioPassword?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    roles?: string[]
    permissions?: string[]
    avatarUrl?: string | null
    exigirCambioPassword?: boolean
    sesionEpoch?: number
  }
}
