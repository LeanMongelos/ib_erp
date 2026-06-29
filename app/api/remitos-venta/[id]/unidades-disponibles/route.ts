import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { listarUnidadesDisponiblesParaRemito } from '@/lib/remitos/venta'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('facturas.read')
    const { id } = await params
    const inventarioId = new URL(req.url).searchParams.get('inventarioId')?.trim()
    if (!inventarioId) throw new ApiError(400, 'Falta inventarioId')

    const { prisma } = await import('@/lib/prisma')
    const remito = await prisma.remitoVenta.findUnique({
      where: { id },
      select: { clienteId: true },
    })
    if (!remito) throw new ApiError(404, 'Remito no encontrado')

    const data = await listarUnidadesDisponiblesParaRemito(inventarioId, remito.clienteId)
    return NextResponse.json(plain(data))
  } catch (error) {
    return handleApiError(error)
  }
}
