/**
 * Rate limit in-memory para intentos fallidos en /api/cron/* (anti brute-force CRON_SECRET).
 */

import { getClientIpFromHeaders } from '@/lib/auth/client-ip'

export const CRON_IP_MAX_FAILURES = Number(process.env.CRON_IP_MAX_FAILURES ?? 30)
const WINDOW_SEC = 3600

type MemEntry = { count: number; expiresAt: number }

const memFailures = new Map<string, MemEntry>()

function cleanup() {
  const now = Date.now()
  for (const [k, v] of memFailures) {
    if (v.expiresAt <= now) memFailures.delete(k)
  }
}

function getFailureCount(ip: string): number {
  cleanup()
  const entry = memFailures.get(ip)
  if (!entry || entry.expiresAt <= Date.now()) return 0
  return entry.count
}

export function cronIpRateLimited(ip: string): boolean {
  return getFailureCount(ip) >= CRON_IP_MAX_FAILURES
}

export function recordCronAuthFailure(ip: string): number {
  cleanup()
  const now = Date.now()
  const entry = memFailures.get(ip)
  const count = entry && entry.expiresAt > now ? entry.count + 1 : 1
  memFailures.set(ip, { count, expiresAt: now + WINDOW_SEC * 1000 })
  return count
}

export function getCronClientIp(headers: Headers): string {
  return getClientIpFromHeaders(headers)
}
