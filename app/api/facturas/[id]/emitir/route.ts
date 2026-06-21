import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { procesarEmisionFactura } from '@/lib/afip/emitir'
import { plain } from '@/lib/serialize'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('facturas.emit_afip')
    const { id } = await params
    const result = await procesarEmisionFactura(id, actor.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.observaciones ?? 'Rechazada por AFIP' }, { status: 422 })
    }
    return NextResponse.json(plain({ ...result.factura, simulado: result.simulado }))
  } catch (error) {
    return handleApiError(error)
  }
}
