/**
 * middleware.ts
 *
 * Protección de rutas del panel (dashboard) vía NextAuth JWT.
 * Aplica headers de seguridad en cada respuesta del matcher.
 *
 * IMPORTANTE — no protege /api/*:
 *   Cada route handler en app/api/ valida su propia auth (requirePermission,
 *   CRON_SECRET, N8N_API_KEY, firma webhook, etc.). Ver docs/AI-MASTER.md §7.
 *
 * Rutas públicas intencionales fuera del matcher:
 *   /login, /api/auth/*, /api/webhooks/*, /api/n8n/*, /api/cron/*, /api/health
 */

import { NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'
import type { NextRequestWithAuth } from 'next-auth/middleware'
import { applySecurityHeaders } from '@/lib/security/headers'
import { sesionIdleExpirada } from '@/lib/auth/sesion-idle'

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    if (req.nextauth.token?.id && sesionIdleExpirada(req.nextauth.token)) {
      const destino = new URL('/login', req.url)
      destino.searchParams.set('sesion', 'expirada')
      return applySecurityHeaders(NextResponse.redirect(destino))
    }

    const exigirCambio = req.nextauth.token?.exigirCambioPassword === true
    const enPerfil = req.nextUrl.pathname.startsWith('/perfil')
    if (exigirCambio && !enPerfil) {
      const destino = new URL('/perfil', req.url)
      destino.searchParams.set('cambio', '1')
      return applySecurityHeaders(NextResponse.redirect(destino))
    }
    return applySecurityHeaders(NextResponse.next())
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      authorized: ({ token }) => Boolean(token?.id),
    },
  },
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/crm/:path*',
    '/clientes/:path*',
    '/presupuestos/:path*',
    '/proveedores/:path*',
    '/cobranzas/:path*',
    '/tesoreria/:path*',
    '/compras/:path*',
    '/servicio-tecnico/:path*',
    '/inventario/:path*',
    '/facturacion/:path*',
    '/automatizaciones/:path*',
    '/reportes/:path*',
    '/configuracion/:path*',
    '/perfil/:path*',
  ],
}
