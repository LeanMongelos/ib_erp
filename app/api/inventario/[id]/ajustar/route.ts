import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { inventarioAjusteSchema } from '@/lib/validation'
import { registrarMovimientoStock } from '@/lib/inventario'
import { trazabilidadActiva } from '@/lib/inventario/unidades'
import { ajustarStockDeposito } from '@/lib/inventario/stock-deposito'
import { plain } from '@/lib/serialize'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('inventario.adjust_stock')
    const { id } = await params
    const data = inventarioAjusteSchema.parse(await req.json())

    const item = await prisma.inventario.findUnique({ where: { id, activo: true } })
    if (!item) throw new ApiError(404, 'Producto no encontrado')

    if (trazabilidadActiva(item.modoTrazabilidad)) {
      throw new ApiError(
        400,
        'Este producto tiene trazabilidad por unidad. Agregá o editá unidades en la pestaña Unidades en lugar de ajustar stock manualmente.',
      )
    }

    if (data.depositoId) {
      const delta = data.tipo === 'SALIDA' ? -data.cantidad : data.cantidad
      await prisma.$transaction(async (tx) => {
        await ajustarStockDeposito(
          {
            inventarioId: id,
            depositoId: data.depositoId!,
            delta,
            ubicacionDetalle: data.ubicacionDetalle,
          },
          tx,
        )
        await registrarMovimientoStock(
          {
            inventarioId: id,
            tipo: data.tipo,
            cantidad: data.cantidad,
            depositoId: data.depositoId,
            motivo: data.motivo ?? `Ajuste manual (${data.tipo})`,
            referencia: `ajuste:${id}`,
            usuarioId: actor.id,
            actualizarStock: false,
          },
          tx,
        )
      })
    } else {
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
    }

    const actualizado = await prisma.inventario.findUnique({
      where: { id },
      include: { alicuotaIva: { select: { id: true, porcentaje: true, nombre: true } } },
    })

    return NextResponse.json(plain(actualizado))
  } catch (error) {
    return handleApiError(error)
  }
}
