import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { construirHistorialAp } from '@/lib/compras/historial-ap'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('compras.read')
    const proveedorId = new URL(req.url).searchParams.get('proveedorId')?.trim()
    if (!proveedorId) throw new ApiError(400, 'Indicá proveedorId')
    const data = await construirHistorialAp(proveedorId)
    return NextResponse.json(plain(data))
  } catch (error) {
    return handleApiError(error)
  }
}
