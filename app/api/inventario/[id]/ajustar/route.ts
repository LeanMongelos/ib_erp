import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { inventarioAjusteSchema } from '@/lib/validation'
import { registrarMovimientoStock } from '@/lib/inventario'
import { plain } from '@/lib/serialize'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('inventario.adjust_stock')
    const { id } = await params
    const data = inventarioAjusteSchema.parse(await req.json())

    const item = await prisma.inventario.findUnique({ where: { id, activo: true } })
    if (!item) throw new ApiError(404, 'Producto no encontrado')

    if (data.tipo === 'SALIDA' && item.stock < data.cantidad) {
      throw new ApiError(400, `Stock insuficiente (disponible: ${item.stock})`)
    }

    await registrarMovimientoStock({
      inventarioId: id,
      tipo: data.tipo,
      cantidad: data.cantidad,
      motivo: data.motivo ?? `Ajuste manual (${data.tipo})`,
      referencia: `ajuste:${id}`,
      usuarioId: actor.id,
    })

    const actualizado = await prisma.inventario.findUnique({
      where: { id },
      include: { alicuotaIva: { select: { id: true, porcentaje: true, nombre: true } } },
    })

    return NextResponse.json(plain(actualizado))
  } catch (error) {
    return handleApiError(error)
  }
}
