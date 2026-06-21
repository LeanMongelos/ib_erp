import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLoginLockStatus, getClientIpFromRequest } from '@/lib/auth/login-rate-limit'
import { applySecurityHeaders } from '@/lib/security/headers'

const schema = z.object({
  email: z.string().email(),
})

/** Consulta bloqueo antes/después de intentar login (sin revelar si el usuario existe). */
export async function POST(req: NextRequest) {
  try {
    const { email } = schema.parse(await req.json())
    const ip = getClientIpFromRequest(req)
    const status = await getLoginLockStatus(ip, email)
    return applySecurityHeaders(NextResponse.json(status))
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }),
    )
  }
}
