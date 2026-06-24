import { NextRequest, NextResponse } from 'next/server'
import { requireDevAlertas, handleApiError } from '@/lib/api-auth'
import { listarAlertasRecientes, ALERTAS_LIMITE } from '@/lib/admin/alertas-recientes'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requireDevAlertas()
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(ALERTAS_LIMITE, Math.max(1, Number(searchParams.get('limit') ?? ALERTAS_LIMITE)))

    const data = await listarAlertasRecientes(page, limit)
    return NextResponse.json(plain(data))
  } catch (error) {
    return handleApiError(error, { req, origen: 'api', ruta: '/api/admin/alertas-recientes' })
  }
}
