import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { construirHistorialAp } from '@/lib/compras/historial-ap'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('compras.read')
    const { id } = await params
    const data = await construirHistorialAp(id)
    return NextResponse.json(plain(data))
  } catch (error) {
    return handleApiError(error)
  }
}
