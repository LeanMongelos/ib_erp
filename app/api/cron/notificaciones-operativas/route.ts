import { NextRequest, NextResponse } from 'next/server'
import { NivelLog } from '@prisma/client'
import { handleApiError } from '@/lib/api-auth'
import { rechazarSiCronNoAutorizado } from '@/lib/cron/auth'
import { procesarEmailsOperativosInbox } from '@/lib/notificaciones/procesar-emails-operativos'
import { actualizarPlanesMantenimientoVencidos } from '@/lib/mantenimiento/actualizar-vencidos'
import { procesarConversacionesSinRespuesta2h } from '@/lib/crm/sin-respuesta-2h'
import { registrarError } from '@/lib/error-log'

/** Cron: emails OT SLA próximo + preventivo próximo (respeta ReglaNotificacion). */
export async function POST(req: NextRequest) {
  try {
    const rechazo = rechazarSiCronNoAutorizado(req)
    if (rechazo) return rechazo

    const planesVencidos = await actualizarPlanesMantenimientoVencidos()
    const result = await procesarEmailsOperativosInbox()
    const crmSinRespuesta = await procesarConversacionesSinRespuesta2h()

    void registrarError({
      nivel: NivelLog.INFO,
      origen: 'cron-notificaciones-operativas',
      mensaje: `planes VENCIDO ${planesVencidos}; OT SLA ${result.otEnviadas}/${result.otRevisadas}; preventivo ${result.preventivoEnviados}/${result.preventivoRevisados}; CRM sin respuesta 2h ${crmSinRespuesta.emitidas}/${crmSinRespuesta.revisadas}`,
      metadata: { planesVencidos, crmSinRespuesta, ...result },
    })

    return NextResponse.json({ ok: true, planesVencidos, crmSinRespuesta, ...result })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}
