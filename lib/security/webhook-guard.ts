/**
 * Rate limit para webhooks públicos (anti flood).
 */

import { getClientIpFromHeaders } from '@/lib/auth/client-ip'
import { assertRateLimit, rateLimitKey } from '@/lib/security/rate-limit'
import { ApiError } from '@/lib/api-auth'

const WEBHOOK_MAX_PER_MIN = Number(process.env.WEBHOOK_MAX_PER_MIN ?? 300)

export async function assertWebhookRateLimit(headers: Headers): Promise<void> {
  const ip = getClientIpFromHeaders(headers)
  try {
    await assertRateLimit(rateLimitKey('webhook', ip), WEBHOOK_MAX_PER_MIN, 60)
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw e
  }
}
