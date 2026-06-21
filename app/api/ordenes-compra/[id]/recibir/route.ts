import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { registrarMovimientoStock } from '@/lib/inventario'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

const recibirSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    cantidad: z.number().int().positive(),
  })).min(1),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.receive')
    const { id } = await params
    const data = recibirSchema.parse(await req.json())

    const oc = await prisma.ordenCompra.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!oc) throw new ApiError(404, 'Orden de compra no encontrada')
    if (oc.estado === 'CANCELADA' || oc.estado === 'RECIBIDA') {
      throw new ApiError(400, `Estado ${oc.estado} no permite recepción`)
    }

    const deposito = await prisma.deposito.findFirst({ where: { activo: true } })

    const updated = await prisma.$transaction(async (tx) => {
      for (const rec of data.items) {
        const item = oc.items.find((i) => i.id === rec.id)
        if (!item) throw new ApiError(400, `Ítem ${rec.id} no pertenece a la OC`)
        const pendiente = item.cantidad - item.cantidadRecibida
        if (rec.cantidad > pendiente) {
          throw new ApiError(400, `Cantidad excede lo pendiente en ${item.descripcion}`)
        }

        await tx.itemOrdenCompra.update({
          where: { id: rec.id },
          data: { cantidadRecibida: item.cantidadRecibida + rec.cantidad },
        })

        if (item.inventarioId) {
          await registrarMovimientoStock({
            inventarioId: item.inventarioId,
            tipo: 'ENTRADA',
            cantidad: rec.cantidad,
            motivo: 'Recepción OC',
            referencia: oc.numero,
            depositoId: deposito?.id,
            usuarioId: actor.id,
          })
        }
      }

      const itemsActualizados = await tx.itemOrdenCompra.findMany({ where: { ordenCompraId: id } })
      const totalmenteRecibida = itemsActualizados.every((i) => i.cantidadRecibida >= i.cantidad)
      const parcial = itemsActualizados.some((i) => i.cantidadRecibida > 0)

      return tx.ordenCompra.update({
        where: { id },
        data: {
          estado: totalmenteRecibida ? 'RECIBIDA' : parcial ? 'PARCIAL' : oc.estado,
          fechaEntrega: totalmenteRecibida ? new Date() : oc.fechaEntrega,
        },
        include: { proveedor: true, items: true },
      })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.recibir',
      entidad: 'OrdenCompra',
      entidadId: id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(updated))
  } catch (error) {
    return handleApiError(error)
  }
}
