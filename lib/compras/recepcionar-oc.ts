import type { Prisma } from '@prisma/client'
import { ApiError } from '@/lib/api-auth'
import { ajustarStockDeposito } from '@/lib/inventario/stock-deposito'
import {
  requiereLote,
  requiereSerie,
  sincronizarStockDesdeUnidades,
  trazabilidadActiva,
  validarDepositoActivo,
  validarUnidadNueva,
} from '@/lib/inventario/unidades'
import { registrarMovimientoStock } from '@/lib/inventario'

export interface RecepcionItemInput {
  id: string
  cantidad: number
  depositoId?: string
  ubicacionDetalle?: string
  unidades?: { numeroSerie?: string; lote?: string }[]
}

export interface RecepcionarOCContext {
  ocId: string
  ocNumero: string
  depositoDestinoDefaultId?: string | null
  items: Array<{
    id: string
    descripcion: string
    cantidad: number
    cantidadRecibida: number
    inventarioId: string | null
    depositoDestinoId: string | null
    inventario?: {
      id: string
      modoTrazabilidad: import('@prisma/client').ModoTrazabilidad
    } | null
  }>
  recepciones: RecepcionItemInput[]
  usuarioId: string
}

export async function recepcionarItemsOC(
  ctx: RecepcionarOCContext,
  tx: Prisma.TransactionClient,
) {
  for (const rec of ctx.recepciones) {
    const item = ctx.items.find((i) => i.id === rec.id)
    if (!item) throw new ApiError(400, `Ítem ${rec.id} no pertenece a la OC`)

    const pendiente = item.cantidad - item.cantidadRecibida
    if (rec.cantidad > pendiente) {
      throw new ApiError(400, `Cantidad excede lo pendiente en ${item.descripcion}`)
    }
    if (rec.cantidad <= 0) continue

    await tx.itemOrdenCompra.update({
      where: { id: rec.id },
      data: { cantidadRecibida: item.cantidadRecibida + rec.cantidad },
    })

    if (!item.inventarioId) continue

    const depositoId =
      rec.depositoId?.trim() ||
      item.depositoDestinoId ||
      ctx.depositoDestinoDefaultId ||
      null

    if (!depositoId) {
      throw new ApiError(400, `Indicá depósito destino para ${item.descripcion}`)
    }
    await validarDepositoActivo(depositoId, tx)

    const inv = item.inventario ?? (await tx.inventario.findUnique({
      where: { id: item.inventarioId },
      select: { id: true, modoTrazabilidad: true },
    }))
    if (!inv) throw new ApiError(404, 'Producto de inventario no encontrado')

    if (trazabilidadActiva(inv.modoTrazabilidad)) {
      const unidades = rec.unidades ?? []
      if (unidades.length !== rec.cantidad) {
        throw new ApiError(
          400,
          `${item.descripcion}: indicá ${rec.cantidad} número(s) de serie/lote (recibidos: ${unidades.length})`,
        )
      }
      for (const u of unidades) {
        if (requiereSerie(inv.modoTrazabilidad) && !u.numeroSerie?.trim()) {
          throw new ApiError(400, `${item.descripcion}: número de serie obligatorio`)
        }
        if (requiereLote(inv.modoTrazabilidad) && !u.lote?.trim()) {
          throw new ApiError(400, `${item.descripcion}: lote obligatorio`)
        }
        await validarUnidadNueva(
          item.inventarioId,
          { numeroSerie: u.numeroSerie, lote: u.lote, depositoId },
          tx,
        )
        await tx.inventarioUnidad.create({
          data: {
            inventarioId: item.inventarioId,
            numeroSerie: u.numeroSerie?.trim() || null,
            lote: u.lote?.trim() || null,
            depositoId,
            ubicacionDetalle: rec.ubicacionDetalle?.trim() || null,
            estado: 'EN_STOCK',
          },
        })
      }
      await sincronizarStockDesdeUnidades(item.inventarioId, tx)
      await registrarMovimientoStock(
        {
          inventarioId: item.inventarioId,
          tipo: 'ENTRADA',
          cantidad: rec.cantidad,
          motivo: 'Recepción OC',
          referencia: ctx.ocNumero,
          depositoId,
          usuarioId: ctx.usuarioId,
          actualizarStock: false,
        },
        tx,
      )
    } else {
      await ajustarStockDeposito(
        {
          inventarioId: item.inventarioId,
          depositoId,
          delta: rec.cantidad,
          ubicacionDetalle: rec.ubicacionDetalle,
        },
        tx,
      )
      await registrarMovimientoStock(
        {
          inventarioId: item.inventarioId,
          tipo: 'ENTRADA',
          cantidad: rec.cantidad,
          motivo: 'Recepción OC',
          referencia: ctx.ocNumero,
          depositoId,
          usuarioId: ctx.usuarioId,
          actualizarStock: false,
        },
        tx,
      )
    }
  }
}
