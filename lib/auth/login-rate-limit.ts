/**
 * Rate limiting de login — estándar OWASP/CIS:
 * - 5 intentos fallidos por email+IP → bloqueo 15 minutos
 * - 30 intentos fallidos por IP/hora (anti escaneo masivo)
 *
 * Configurable vía env: LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MINUTES, LOGIN_IP_MAX_HOURLY
 */

import { getClientIpFromHeaders } from '@/lib/auth/client-ip'

export const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5)
export const LOGIN_LOCKOUT_MINUTES = Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15)
export const LOGIN_IP_MAX_HOURLY = Number(process.env.LOGIN_IP_MAX_HOURLY ?? 30)

const LOCKOUT_SEC = LOGIN_LOCKOUT_MINUTES * 60
const IP_WINDOW_SEC = 3600

type MemoryEntry = { count: number; expiresAt: number }
type MemoryLock = { until: number }

const memAttempts = new Map<string, MemoryEntry>()
const memLocks = new Map<string, MemoryLock>()
const memIpCounts = new Map<string, MemoryEntry>()

function normEmail(email: string) {
  return email.trim().toLowerCase()
}

function attemptKey(ip: string, email: string) {
  return `${ip}:${normEmail(email)}`
}

function lockKey(ip: string, email: string) {
  return `login:lock:${ip}:${normEmail(email)}`
}

function attemptsRedisKey(ip: string, email: string) {
  return `login:attempts:${ip}:${normEmail(email)}`
}

function ipRedisKey(ip: string) {
  return `login:ip:${ip}`
}

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
  for (const [k, v] of memAttempts) if (v.expiresAt <= now) memAttempts.delete(k)
  for (const [k, v] of memLocks) if (v.until <= now) memLocks.delete(k)
  for (const [k, v] of memIpCounts) if (v.expiresAt <= now) memIpCounts.delete(k)
}

export type LoginLockStatus = {
  locked: boolean
  retryAfterMinutes: number
  attemptsRemaining: number
  maxAttempts: number
  reason?: 'account' | 'ip'
  /** true solo en el intento que activó el bloqueo (evita spam de emails) */
  newlyLocked?: boolean
  newlyIpLocked?: boolean
}

async function getLockStatusRedis(
  redis: { ttl: (k: string) => Promise<number>; get: (k: string) => Promise<string | null> },
  ip: string,
  email: string,
): Promise<LoginLockStatus> {
  const lk = lockKey(ip, email)
  const ttl = await redis.ttl(lk)
  if (ttl > 0) {
    return {
      locked: true,
      retryAfterMinutes: Math.ceil(ttl / 60),
      attemptsRemaining: 0,
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      reason: 'account',
    }
  }

  const ipTtl = await redis.ttl(ipRedisKey(ip))
  const ipCount = Number(await redis.get(ipRedisKey(ip)) ?? 0)
  if (ipCount >= LOGIN_IP_MAX_HOURLY && ipTtl > 0) {
    return {
      locked: true,
      retryAfterMinutes: Math.ceil(ipTtl / 60),
      attemptsRemaining: 0,
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      reason: 'ip',
    }
  }

  const count = Number(await redis.get(attemptsRedisKey(ip, email)) ?? 0)
  return {
    locked: false,
    retryAfterMinutes: 0,
    attemptsRemaining: Math.max(0, LOGIN_MAX_ATTEMPTS - count),
    maxAttempts: LOGIN_MAX_ATTEMPTS,
  }
}

function getLockStatusMemory(ip: string, email: string): LoginLockStatus {
  memCleanup()
  const key = attemptKey(ip, email)
  const lock = memLocks.get(key)
  if (lock && lock.until > Date.now()) {
    return {
      locked: true,
      retryAfterMinutes: Math.ceil((lock.until - Date.now()) / 60000),
      attemptsRemaining: 0,
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      reason: 'account',
    }
  }

  const ipEntry = memIpCounts.get(ip)
  if (ipEntry && ipEntry.expiresAt > Date.now() && ipEntry.count >= LOGIN_IP_MAX_HOURLY) {
    return {
      locked: true,
      retryAfterMinutes: Math.ceil((ipEntry.expiresAt - Date.now()) / 60000),
      attemptsRemaining: 0,
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      reason: 'ip',
    }
  }

  const att = memAttempts.get(key)
  const count = att && att.expiresAt > Date.now() ? att.count : 0
  return {
    locked: false,
    retryAfterMinutes: 0,
    attemptsRemaining: Math.max(0, LOGIN_MAX_ATTEMPTS - count),
    maxAttempts: LOGIN_MAX_ATTEMPTS,
  }
}

export async function getLoginLockStatus(ip: string, email: string): Promise<LoginLockStatus> {
  const redis = await getRedis()
  if (redis) {
    try {
      return await getLockStatusRedis(redis, ip, email)
    } catch {
      /* fallback memoria */
    }
  }
  return getLockStatusMemory(ip, email)
}

export async function recordLoginFailure(ip: string, email: string): Promise<LoginLockStatus> {
  const redis = await getRedis()
  if (redis) {
    try {
      const attKey = attemptsRedisKey(ip, email)
      const count = await redis.incr(attKey)
      if (count === 1) await redis.expire(attKey, LOCKOUT_SEC)

      const ipKey = ipRedisKey(ip)
      const ipCount = await redis.incr(ipKey)
      if (ipCount === 1) await redis.expire(ipKey, IP_WINDOW_SEC)

      if (count >= LOGIN_MAX_ATTEMPTS) {
        await redis.set(lockKey(ip, email), '1', 'EX', LOCKOUT_SEC)
      }

      const status = await getLockStatusRedis(redis, ip, email)
      return {
        ...status,
        newlyLocked: count === LOGIN_MAX_ATTEMPTS,
        newlyIpLocked: ipCount === LOGIN_IP_MAX_HOURLY,
      }
    } catch {
      /* fallback */
    }
  }

  memCleanup()
  const key = attemptKey(ip, email)
  const now = Date.now()
  const att = memAttempts.get(key)
  const count = att && att.expiresAt > now ? att.count + 1 : 1
  memAttempts.set(key, { count, expiresAt: now + LOCKOUT_SEC * 1000 })

  const ipEntry = memIpCounts.get(ip)
  const ipCount = ipEntry && ipEntry.expiresAt > now ? ipEntry.count + 1 : 1
  memIpCounts.set(ip, { count: ipCount, expiresAt: now + IP_WINDOW_SEC * 1000 })

  if (count >= LOGIN_MAX_ATTEMPTS) {
    memLocks.set(key, { until: now + LOCKOUT_SEC * 1000 })
  }

  const status = getLockStatusMemory(ip, email)
  return {
    ...status,
    newlyLocked: count === LOGIN_MAX_ATTEMPTS,
    newlyIpLocked: ipCount === LOGIN_IP_MAX_HOURLY,
  }
}

export async function clearLoginAttempts(ip: string, email: string): Promise<void> {
  const redis = await getRedis()
  if (redis) {
    try {
      await redis.del(attemptsRedisKey(ip, email), lockKey(ip, email))
    } catch {
      /* ignore */
    }
  }
  memAttempts.delete(attemptKey(ip, email))
  memLocks.delete(attemptKey(ip, email))
}

export function getClientIpFromRequest(req: Request): string {
  return getClientIpFromHeaders(req.headers)
}
