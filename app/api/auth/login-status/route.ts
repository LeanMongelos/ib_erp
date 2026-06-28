import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLoginLockStatus, getClientIpFromRequest } from '@/lib/auth/login-rate-limit'
import { applySecurityHeaders } from '@/lib/security/headers'
import { assertRateLimit, rateLimitKey } from '@/lib/security/rate-limit'
import { handleApiError } from '@/lib/api-auth'

const schema = z.object({
  email: z.string().email(),
})

const LOGIN_STATUS_MAX = Number(process.env.LOGIN_STATUS_MAX_HOURLY ?? 120)

/** Consulta bloqueo antes/después de intentar login (sin revelar si el usuario existe). */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIpFromRequest(req)
    await assertRateLimit(rateLimitKey('login-status', ip), LOGIN_STATUS_MAX, 3600)

    const { email } = schema.parse(await req.json())
    const status = await getLoginLockStatus(ip, email)
    return applySecurityHeaders(NextResponse.json(status))
  } catch (error) {
    return handleApiError(error)
  }
}
