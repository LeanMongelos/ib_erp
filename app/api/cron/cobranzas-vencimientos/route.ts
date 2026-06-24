import { NextRequest, NextResponse } from 'next/server'
import { NivelLog } from '@prisma/client'
import { handleApiError } from '@/lib/api-auth'
import { rechazarSiCronNoAutorizado } from '@/lib/cron/auth'
import { procesarVencimientosDelDia } from '@/lib/cobranzas/procesar-vencimientos'
import { procesarChequesADepositar } from '@/lib/cobranzas/procesar-cheques'
import { registrarError } from '@/lib/error-log'

/** Cron externo: POST con header Authorization: Bearer CRON_SECRET */
export async function POST(req: NextRequest) {
  try {
    const rechazo = rechazarSiCronNoAutorizado(req)
    if (rechazo) return rechazo

    const result = await procesarVencimientosDelDia()
    const cheques = await procesarChequesADepositar()

    void registrarError({
      nivel: NivelLog.INFO,
      origen: 'cron-cobranzas',
      mensaje: `vencimientos procesados: ${result.enviados}/${result.revisados} aviso(s) internos; ` +
        `${result.facturasMarcadasVencidas} factura(s) VENCIDA; ` +
        `cliente vencido ${result.recordatoriosClienteVencidos}, próximo ${result.recordatoriosClienteProximos}; ` +
        `cheques a depositar ${cheques.avisosEnviados}/${cheques.revisados}`,
      metadata: { ...result, cheques },
    })

    return NextResponse.json({ ok: true, ...result, cheques })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}
