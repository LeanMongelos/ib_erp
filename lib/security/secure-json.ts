import { NextResponse } from 'next/server'
import { redactForClient } from '@/lib/security/redact'
import { applySecurityHeaders } from '@/lib/security/headers'

/** JSON hacia el cliente con redacción automática de secretos. */
export function secureJson(data: unknown, init?: ResponseInit) {
  const body = JSON.stringify(redactForClient(data))
  const res = new NextResponse(body, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  return applySecurityHeaders(res) as NextResponse
}
