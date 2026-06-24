/**
 * Headers de seguridad HTTP para todas las respuestas.
 */

const isProd = process.env.NODE_ENV === 'production'

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-DNS-Prefetch-Control': 'off',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  ...(isProd
    ? {
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          // Vista previa PDF en plantillas: iframe/embed con blob: tras fetch autenticado
          "frame-src 'self' blob:",
          "object-src 'self' blob:",
          "connect-src 'self' https://graph.facebook.com https://login.microsoftonline.com https://graph.microsoft.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      }
    : {}),
}

export function applySecurityHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}
