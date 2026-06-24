import { NextRequest, NextResponse } from 'next/server'
import { NivelLog } from '@prisma/client'
import { handleApiError } from '@/lib/api-auth'
import { rechazarSiCronNoAutorizado } from '@/lib/cron/auth'
import { procesarEmailsOperativosInbox } from '@/lib/notificaciones/procesar-emails-operativos'
import { registrarError } from '@/lib/error-log'

/** Cron: emails OT SLA próximo + preventivo próximo (respeta ReglaNotificacion). */
export async function POST(req: NextRequest) {
  try {
    const rechazo = rechazarSiCronNoAutorizado(req)
    if (rechazo) return rechazo

    const result = await procesarEmailsOperativosInbox()

    void registrarError({
      nivel: NivelLog.INFO,
      origen: 'cron-notificaciones-operativas',
      mensaje: `OT SLA ${result.otEnviadas}/${result.otRevisadas}; preventivo ${result.preventivoEnviados}/${result.preventivoRevisados}`,
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
