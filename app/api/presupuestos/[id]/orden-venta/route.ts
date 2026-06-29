import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { crearOrdenVentaDesdePresupuesto } from '@/lib/ventas/orden-venta'
import { plain } from '@/lib/serialize'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('presupuestos.approve')
    const { id } = await params
    const ov = await crearOrdenVentaDesdePresupuesto(id)
    return NextResponse.json(plain(ov), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
