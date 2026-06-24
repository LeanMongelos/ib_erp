import { NextRequest, NextResponse } from 'next/server'

/** Rechaza si falta CRON_SECRET o el header Authorization Bearer no coincide. */
export function rechazarSiCronNoAutorizado(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')?.trim()
  if (!auth || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  return null
}
