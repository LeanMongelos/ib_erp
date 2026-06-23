import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-auth'
import { procesarVencimientosDelDia } from '@/lib/cobranzas/procesar-vencimientos'

/** Cron externo: POST con header Authorization: Bearer CRON_SECRET */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 503 })
    }
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const result = await procesarVencimientosDelDia()
    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
