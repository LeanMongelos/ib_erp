import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { obtenerPagoProveedor } from '@/lib/compras/pago-proveedor'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('compras.read')
    const { id } = await params
    const pago = await obtenerPagoProveedor(id)
    return NextResponse.json(plain(pago))
  } catch (error) {
    return handleApiError(error)
  }
}
