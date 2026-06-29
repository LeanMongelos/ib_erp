import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { obtenerRemitoVenta } from '@/lib/remitos/venta'
import { plain } from '@/lib/serialize'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('facturas.read')
    const { id } = await params
    const remito = await obtenerRemitoVenta(id)
    return NextResponse.json(plain(remito))
  } catch (error) {
    return handleApiError(error)
  }
}
