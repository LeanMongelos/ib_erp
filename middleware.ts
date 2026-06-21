/**
 * middleware.ts
 * Protección centralizada de rutas del panel + headers de seguridad.
 * Las APIs públicas (webhooks, n8n, OAuth callback) quedan fuera del matcher.
 */

import { NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'
import { applySecurityHeaders } from '@/lib/security/headers'

export default withAuth(
  function middleware() {
    return applySecurityHeaders(NextResponse.next())
  },
  { pages: { signIn: '/login' } },
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/crm/:path*',
    '/presupuestos/:path*',
    '/proveedores/:path*',
    '/cobranzas/:path*',
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
