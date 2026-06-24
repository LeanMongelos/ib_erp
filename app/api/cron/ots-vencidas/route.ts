import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-auth'
import { rechazarSiCronNoAutorizado } from '@/lib/cron/auth'
import { actualizarOTsVencidas } from '@/lib/ots'

/** Cron externo: POST con header Authorization: Bearer CRON_SECRET */
export async function POST(req: NextRequest) {
  try {
    const rechazo = rechazarSiCronNoAutorizado(req)
    if (rechazo) return rechazo

    const actualizadas = await actualizarOTsVencidas()
    return NextResponse.json({ ok: true, actualizadas })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}
