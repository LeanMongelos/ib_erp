import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { consultarCuentaCorriente } from '@/lib/compras/cuenta-corriente'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('compras.read')
    const proveedorId = new URL(req.url).searchParams.get('proveedorId')?.trim() ?? undefined
    const data = await consultarCuentaCorriente(proveedorId)
    return NextResponse.json(plain(data))
  } catch (error) {
    return handleApiError(error)
  }
}
