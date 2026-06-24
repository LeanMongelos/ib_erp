/**
 * lib/auth.ts
 * Configuración de NextAuth.js v4 — autenticación del sistema.
 *
 * Estrategia: JWT (JSON Web Token)
 * - El token se guarda en una cookie firmada en el browser del usuario.
 * - No se usa sesión en base de datos, lo que simplifica el deployment.
 * - El rol del usuario viaja dentro del token para no ir a la DB en cada request.
 *
 * Flujo de login:
 * 1. El usuario ingresa email + password en /login
 * 2. NextAuth llama a `authorize()` con esas credenciales
 * 3. Buscamos el usuario en la DB y comparamos el hash de la contraseña con bcrypt
 * 4. Si todo es válido, devolvemos el objeto usuario → NextAuth genera el JWT
 * 5. En cada request, los callbacks jwt() y session() enriquecen la sesión con el rol
 *
 * Duración de sesión: leída de PoliticaSeguridad.sesionMaxHoras (default 8 h).
 * updateAge > maxAge evita renovación deslizante — expira de forma absoluta desde el login.
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { permisosDeRoles } from '@/lib/rbac'
import { esUsuarioAlertasDev } from '@/lib/dev/alertas-dev'
import { getClientIp } from '@/lib/auth/client-ip'
import {
  getLoginLockStatus,
  recordLoginFailure,
  clearLoginAttempts,
} from '@/lib/auth/login-rate-limit'
import { registrarAuditoria } from '@/lib/audit'
import { notifyAdminLoginLockout } from '@/lib/auth/login-lock-notify'
import { obtenerPoliticaSeguridad, obtenerSesionEpoch } from '@/lib/config/politica-seguridad'

const DEFAULT_SESION_MAX_HORAS = 8

// Fallback: si un usuario todavía no tiene roles RBAC asignados, mapeamos su
// rol legado (columna `rol`) a un rol del nuevo sistema.
const ROL_LEGADO_A_RBAC: Record<string, string> = {
  ADMIN:       'SUPERADMIN',
  TECNICO:     'TECNICO',
  VENTAS:      'VENTAS',
  FACTURACION: 'FACTURACION',
}

function buildAuthOptions(maxAge: number): NextAuthOptions {
  return {
    session: {
      strategy: 'jwt',
      maxAge,
      updateAge: maxAge + 1, // sin extensión deslizante — expira desde el login
    },
    jwt: {
      maxAge,
    },

    pages: { signIn: '/login' },

    providers: [
      CredentialsProvider({
        name: 'credentials',
        credentials: {
          email:    { label: 'Email',      type: 'email' },
          password: { label: 'Contraseña', type: 'password' },
        },

        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null

          const email = credentials.email.trim().toLowerCase()
          const ip = await getClientIp()

          const lock = await getLoginLockStatus(ip, email)
          if (lock.locked) return null

          const usuario = await prisma.usuario.findUnique({
            where: { email },
          })
          const fail = async () => {
            const after = await recordLoginFailure(ip, email)
            if (after.newlyLocked || after.newlyIpLocked) {
              await registrarAuditoria({
                accion: 'login.rate_limited',
                entidad: 'Usuario',
                entidadId: usuario?.id,
                despues: {
                  ip,
                  email,
                  reason: after.newlyLocked ? 'account' : 'ip',
                },
              }).catch(() => {})

              notifyAdminLoginLockout({
                email,
                ip,
                reason: after.newlyLocked ? 'account' : 'ip',
                retryAfterMinutes: after.retryAfterMinutes,
                usuarioNombre: usuario?.nombre ?? null,
              }).catch((err) => console.error('[login-lock-notify]', err))
            }
            return null
          }

          if (!usuario || !usuario.activo) return fail()

          const passwordOk = await bcrypt.compare(credentials.password, usuario.password)
          if (!passwordOk) return fail()

          await clearLoginAttempts(ip, email)

          await registrarAuditoria({
            usuarioId: usuario.id,
            accion: 'login.success',
            entidad: 'Usuario',
            entidadId: usuario.id,
            ip,
          }).catch(() => {})

          const usuarioRoles = await prisma.usuarioRol.findMany({
            where: { usuarioId: usuario.id },
            include: { rol: true },
          })
          let roles = usuarioRoles.map((ur) => ur.rol.clave)
          if (roles.length === 0) {
            roles = [ROL_LEGADO_A_RBAC[usuario.rol] ?? 'TECNICO']
          }
          const permissions = permisosDeRoles(roles)

          prisma.usuario
            .update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } })
            .catch(() => {})

          return {
            id:        usuario.id,
            name:      usuario.nombre,
            email:     usuario.email,
            role:      roles[0],
            roles,
            permissions,
            avatarUrl: usuario.avatarUrl,
            exigirCambioPassword: usuario.exigirCambioPassword,
          } as {
            id: string
            name: string
            email: string
            role: string
            roles: string[]
            permissions: string[]
            avatarUrl: string | null
            exigirCambioPassword: boolean
          }
        },
      }),
    ],

    callbacks: {
      async jwt({ token, user, trigger, session }) {
        const sesionEpochActual = await obtenerSesionEpoch()

        if (user) {
          token.sesionEpoch = sesionEpochActual
          token.role        = user.role
          token.id          = user.id
          token.roles       = (user as { roles?: string[] }).roles ?? []
          token.permissions = (user as { permissions?: string[] }).permissions ?? []
          token.avatarUrl   = (user as { avatarUrl?: string | null }).avatarUrl ?? null
          token.exigirCambioPassword = (user as { exigirCambioPassword?: boolean }).exigirCambioPassword ?? false
        } else if ((token.sesionEpoch as number | undefined) !== sesionEpochActual) {
          delete token.id
          delete token.sub
          delete token.role
          delete token.roles
          delete token.permissions
          delete token.avatarUrl
          delete token.exigirCambioPassword
          token.sesionEpoch = sesionEpochActual
        }
        if (trigger === 'update' && session) {
          const s = session as {
            name?: string
            avatarUrl?: string | null
            exigirCambioPassword?: boolean
          }
          if (s.name !== undefined) token.name = s.name
          if (s.avatarUrl !== undefined) token.avatarUrl = s.avatarUrl
          if (s.exigirCambioPassword === false) token.exigirCambioPassword = false
        }
        token.devAlertasUi = esUsuarioAlertasDev({
          email: (token.email as string | undefined) ?? user?.email,
          roles: (token.roles as string[] | undefined) ?? (user as { roles?: string[] })?.roles,
        })
        return token
      },

      async session({ session, token }) {
        if (!token?.id) {
          return { ...session, user: undefined, expires: new Date(0).toISOString() }
        }
        if (token && session.user) {
          session.user.role        = token.role ?? ''
          session.user.id          = token.id
          session.user.roles       = token.roles ?? []
          session.user.permissions = token.permissions ?? []
          session.user.avatarUrl   = token.avatarUrl ?? null
          session.user.image       = token.avatarUrl ?? undefined
          session.user.exigirCambioPassword = token.exigirCambioPassword ?? false
          session.user.devAlertasUi = token.devAlertasUi ?? false
        }
        return session
      },
    },
  }
}

/** Opciones de NextAuth con duración de sesión según política de seguridad en BD. */
export async function getAuthOptions(): Promise<NextAuthOptions> {
  const politica = await obtenerPoliticaSeguridad()
  const maxAge = politica.sesionMaxHoras * 3600
  return buildAuthOptions(maxAge)
}

/** Fallback estático (8 h) cuando no se puede leer la política de forma async. */
export const authOptions: NextAuthOptions = buildAuthOptions(DEFAULT_SESION_MAX_HORAS * 3600)
