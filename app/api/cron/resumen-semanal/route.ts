import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-auth'
import { rechazarSiCronNoAutorizado } from '@/lib/cron/auth'
import { procesarResumenSemanalAdmin } from '@/lib/admin/resumen-semanal'

/** Cron externo: POST con header Authorization: Bearer CRON_SECRET — domingo 08:00 */
export async function POST(req: NextRequest) {
  try {
    const rechazo = rechazarSiCronNoAutorizado(req)
    if (rechazo) return rechazo

    const resultado = await procesarResumenSemanalAdmin()
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}
