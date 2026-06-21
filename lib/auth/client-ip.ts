import { headers } from 'next/headers'

/** IP del cliente detrás de proxy (Caddy/Nginx en VPS). */
export function getClientIpFromHeaders(h: Headers): string {
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = h.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

export async function getClientIp(): Promise<string> {
  return getClientIpFromHeaders(await headers())
}
