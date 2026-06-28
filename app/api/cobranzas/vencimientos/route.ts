import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { obtenerCronogramaCobranzas } from '@/lib/cobranzas/cronograma-cobranzas'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('cobranzas.read')
    const { searchParams } = new URL(req.url)
    const soloPendientes = searchParams.get('pendientes') !== 'false'
    const dias = Number(searchParams.get('dias') ?? 120)
    const origenRaw = searchParams.get('origen') ?? 'TODOS'
    const origen =
      origenRaw === 'FACTURA' || origenRaw === 'ALQUILER' ? origenRaw : ('TODOS' as const)

    const items = await obtenerCronogramaCobranzas({ dias, soloPendientes, origen })

    return NextResponse.json(plain(items))
  } catch (error) {
    return handleApiError(error)
  }
}
