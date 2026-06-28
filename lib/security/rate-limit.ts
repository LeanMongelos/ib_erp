/**
 * Rate limiting genérico (Redis con fallback in-memory).
 * Usado en endpoints públicos o sensibles: login-status, webhooks, etc.
 */

import { ApiError } from '@/lib/api-auth'

type MemEntry = { count: number; expiresAt: number }

const memStore = new Map<string, MemEntry>()

let redisSingleton: import('ioredis').default | null = null

async function getRedis() {
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    if (!redisSingleton) {
      const { default: Redis } = await import('ioredis')
      redisSingleton = new Redis(url, { maxRetriesPerRequest: 1 })
    }
    return redisSingleton
  } catch {
    return null
  }
}

function memCleanup() {
  const now = Date.now()
  for (const [k, v] of memStore) {
    if (v.expiresAt <= now) memStore.delete(k)
  }
}

function memIncrement(key: string, windowSec: number): number {
  memCleanup()
  const now = Date.now()
  const entry = memStore.get(key)
  const count = entry && entry.expiresAt > now ? entry.count + 1 : 1
  memStore.set(key, { count, expiresAt: now + windowSec * 1000 })
  return count
}

function memCount(key: string): number {
  memCleanup()
  const entry = memStore.get(key)
  if (!entry || entry.expiresAt <= Date.now()) return 0
  return entry.count
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

export async function checkRateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const redis = await getRedis()
  if (redis) {
    const redisKey = `ratelimit:${key}`
    const count = await redis.incr(redisKey)
    if (count === 1) await redis.expire(redisKey, windowSec)
    const ttl = await redis.ttl(redisKey)
    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      retryAfterSec: ttl > 0 ? ttl : windowSec,
    }
  }

  const count = memIncrement(key, windowSec)
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    retryAfterSec: windowSec,
  }
}

export async function assertRateLimit(key: string, max: number, windowSec: number): Promise<void> {
  const { allowed, retryAfterSec } = await checkRateLimit(key, max, windowSec)
  if (!allowed) {
    throw new ApiError(
      429,
      `Demasiadas solicitudes. Reintentá en ${Math.ceil(retryAfterSec / 60) || 1} min.`,
    )
  }
}

export function rateLimitKey(prefix: string, ip: string, extra?: string): string {
  return extra ? `${prefix}:${ip}:${extra}` : `${prefix}:${ip}`
}
