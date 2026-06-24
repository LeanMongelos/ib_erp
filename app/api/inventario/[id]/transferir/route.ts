import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { inventarioTransferenciaSchema } from '@/lib/validation'
import { transferirStockEntreDepositos } from '@/lib/inventario/transferir-stock'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('inventario.transfer')
    const { id } = await params
    const data = inventarioTransferenciaSchema.parse(await req.json())

    await transferirStockEntreDepositos({
      inventarioId: id,
      depositoOrigenId: data.depositoOrigenId,
      depositoDestinoId: data.depositoDestinoId,
      cantidad: data.cantidad,
      motivo: data.motivo,
      usuarioId: actor.id,
    })

    const actualizado = await prisma.inventario.findUnique({
      where: { id },
      include: { alicuotaIva: { select: { id: true, porcentaje: true, nombre: true } } },
    })
    if (!actualizado) throw new ApiError(404, 'Producto no encontrado')

    return NextResponse.json(plain(actualizado))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Stock insuficiente')) {
      return handleApiError(new ApiError(400, error.message))
    }
    if (error instanceof Error && (error.message.includes('Depósito') || error.message.includes('distintos'))) {
      return handleApiError(new ApiError(400, error.message))
    }
    return handleApiError(error)
  }
}
