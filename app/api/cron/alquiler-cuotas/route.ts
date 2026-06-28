import { NextRequest, NextResponse } from 'next/server'
import { NivelLog } from '@prisma/client'
import { handleApiError } from '@/lib/api-auth'
import { rechazarSiCronNoAutorizado } from '@/lib/cron/auth'
import { procesarCuotasAlquilerDelDia } from '@/lib/alquiler/procesar-cuotas-alquiler'
import { registrarError } from '@/lib/error-log'

/** Cron externo: POST con header Authorization: Bearer CRON_SECRET */
export async function POST(req: NextRequest) {
  try {
    const rechazo = rechazarSiCronNoAutorizado(req)
    if (rechazo) return rechazo

    const result = await procesarCuotasAlquilerDelDia()

    void registrarError({
      nivel: NivelLog.INFO,
      origen: 'cron-alquiler-cuotas',
      mensaje: `cuotas alquiler: ${result.creadas} generada(s) período ${result.periodo}; ` +
        `${result.cuotasMarcadasVencidas} marcada(s) VENCIDA`,
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
