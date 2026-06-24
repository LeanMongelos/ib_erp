import { NextRequest, NextResponse } from 'next/server'
import {
  cronIpRateLimited,
  getCronClientIp,
  recordCronAuthFailure,
} from '@/lib/cron/rate-limit'

/** Rechaza si falta CRON_SECRET, rate limit por IP o Bearer inválido. */
export function rechazarSiCronNoAutorizado(req: NextRequest): NextResponse | null {
  const ip = getCronClientIp(req.headers)

  if (cronIpRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Demasiados intentos — espere antes de reintentar' },
      { status: 429 },
    )
  }

  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 503 })
  }

  const auth = req.headers.get('authorization')?.trim()
  if (!auth || auth !== `Bearer ${secret}`) {
    recordCronAuthFailure(ip)
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  return null
}
