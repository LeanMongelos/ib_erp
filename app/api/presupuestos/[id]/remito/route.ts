import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { crearRemitoDesdePresupuesto } from '@/lib/remitos/venta'
import { plain } from '@/lib/serialize'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('facturas.create')
    const { id } = await params
    const remito = await crearRemitoDesdePresupuesto(id)
    return NextResponse.json(plain(remito), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
