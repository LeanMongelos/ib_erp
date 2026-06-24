import { NextRequest, NextResponse } from 'next/server'
import { NivelLog } from '@prisma/client'
import { handleApiError } from '@/lib/api-auth'
import { rechazarSiCronNoAutorizado } from '@/lib/cron/auth'
import { procesarVencimientosDelDia } from '@/lib/cobranzas/procesar-vencimientos'
import { registrarError } from '@/lib/error-log'

/** Cron externo: POST con header Authorization: Bearer CRON_SECRET */
export async function POST(req: NextRequest) {
  try {
    const rechazo = rechazarSiCronNoAutorizado(req)
    if (rechazo) return rechazo

    const result = await procesarVencimientosDelDia()

    void registrarError({
      nivel: NivelLog.INFO,
      origen: 'cron-cobranzas',
      mensaje: `vencimientos procesados: ${result.enviados}/${result.revisados} aviso(s)`,
      metadata: result,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}
