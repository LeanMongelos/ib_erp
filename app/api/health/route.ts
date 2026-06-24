import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/prisma'

function resolveCommitSha(): string | null {
  if (process.env.GIT_COMMIT_SHA) return process.env.GIT_COMMIT_SHA.slice(0, 12)
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12)
  try {
    const head = readFileSync(join(process.cwd(), '.git', 'HEAD'), 'utf8').trim()
    if (head.startsWith('ref:')) {
      const ref = head.slice(5).trim()
      return readFileSync(join(process.cwd(), '.git', ref), 'utf8').trim().slice(0, 12)
    }
    return head.slice(0, 12)
  } catch {
    return null
  }
}

async function checkRedis(): Promise<'ok' | 'skipped' | 'error'> {
  const url = process.env.REDIS_URL?.trim()
  if (!url) return 'skipped'
  try {
    const { default: Redis } = await import('ioredis')
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      lazyConnect: true,
    })
    await client.connect()
    const pong = await client.ping()
    await client.quit()
    return pong === 'PONG' ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

/** Health check para monitoreo externo (UptimeRobot, etc.). Sin secretos. */
export async function GET() {
  const ts = new Date().toISOString()
  let db: 'ok' | 'error' = 'error'

  try {
    await prisma.$queryRaw`SELECT 1`
    db = 'ok'
  } catch {
    db = 'error'
  }

  const redis = await checkRedis()
  const ok = db === 'ok'

  return NextResponse.json(
    {
      ok,
      db,
      redis,
      version: process.env.npm_package_version ?? '0.1.0',
      commit: resolveCommitSha(),
      ts,
    },
    { status: ok ? 200 : 503 },
  )
}
