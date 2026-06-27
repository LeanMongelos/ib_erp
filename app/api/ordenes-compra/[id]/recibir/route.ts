import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { ordenCompraRecibirSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { ocEsRecepcionable } from '@/lib/compras/oc'
import { recepcionarItemsOC } from '@/lib/compras/recepcionar-oc'
import { ocInclude } from '@/lib/compras/oc-include'
import { registrarEventoRecepcionOc } from '@/lib/compras/oc-workflow/hooks'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.receive')
    const { id } = await params
    const data = ordenCompraRecibirSchema.parse(await req.json())

    const oc = await prisma.ordenCompra.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            inventario: { select: { id: true, modoTrazabilidad: true } },
          },
        },
      },
    })
    if (!oc) throw new ApiError(404, 'Orden de compra no encontrada')
    if (oc.estado === 'CANCELADA' || oc.estado === 'RECIBIDA') {
      throw new ApiError(400, `Estado ${oc.estado} no permite recepción`)
    }
    if (!ocEsRecepcionable(oc.estado)) {
      throw new ApiError(400, 'La OC debe estar aprobada antes de recepcionar mercadería')
    }

    const updated = await prisma.$transaction(async (tx) => {
      await recepcionarItemsOC(
        {
          ocId: id,
          ocNumero: oc.numero,
          depositoDestinoDefaultId: oc.depositoDestinoDefaultId,
          items: oc.items,
          recepciones: data.items,
          usuarioId: actor.id,
        },
        tx,
      )

      const itemsActualizados = await tx.itemOrdenCompra.findMany({ where: { ordenCompraId: id } })
      const totalmenteRecibida = itemsActualizados.every((i) => i.cantidadRecibida >= i.cantidad)
      const parcial = itemsActualizados.some((i) => i.cantidadRecibida > 0)

      await registrarEventoRecepcionOc(
        id,
        oc.numero,
        actor.id,
        itemsActualizados,
        data.items,
        totalmenteRecibida,
        tx,
      )

      return tx.ordenCompra.update({
        where: { id },
        data: {
          estado: totalmenteRecibida ? 'RECIBIDA' : parcial ? 'PARCIAL' : oc.estado,
          fechaEntrega: totalmenteRecibida ? new Date() : oc.fechaEntrega,
          ultimaRecepcionEn: new Date(),
        },
        include: ocInclude,
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
