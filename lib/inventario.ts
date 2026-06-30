/**
 * lib/inventario.ts — movimientos de stock y alertas de faltante.
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type DbClient = Prisma.TransactionClient | typeof prisma

export async function registrarMovimientoStock(
  opts: {
    inventarioId: string
    tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'AJUSTE_NEGATIVO' | 'TRANSFERENCIA'
    cantidad: number
    motivo?: string
    referencia?: string
    depositoId?: string
    usuarioId?: string
    /** false = solo auditoría (p. ej. stock ya reconciliado vía StockDeposito) */
    actualizarStock?: boolean
  },
  db?: Prisma.TransactionClient,
) {
  const run = async (client: DbClient) => {
    const item = await client.inventario.findUnique({ where: { id: opts.inventarioId } })
    if (!item) throw new Error('Ítem de inventario no encontrado')

    const delta =
      opts.tipo === 'SALIDA' || opts.tipo === 'AJUSTE_NEGATIVO'
        ? -opts.cantidad
        : opts.tipo === 'TRANSFERENCIA'
          ? 0
          : opts.cantidad
    const stockAntes = item.stock
    const stockDespues =
      opts.actualizarStock === false ? stockAntes : stockAntes + delta

    const mov = await client.movimientoStock.create({
      data: {
        inventarioId: opts.inventarioId,
        depositoId: opts.depositoId ?? null,
        tipo: opts.tipo,
        cantidad: opts.cantidad,
        stockAntes,
        stockDespues,
        motivo: opts.motivo ?? null,
        referencia: opts.referencia ?? null,
        usuarioId: opts.usuarioId ?? null,
      },
    })
    if (opts.actualizarStock !== false) {
      await client.inventario.update({
        where: { id: opts.inventarioId },
        data: { stock: stockDespues },
      })
    }
    return mov
  }

  if (db) return run(db)
  return prisma.$transaction((tx) => run(tx))
}

export async function getFaltantesStock() {
  const items = await prisma.inventario.findMany({
    where: { activo: true },
    include: {
      proveedores: {
        orderBy: { costo: 'asc' },
        take: 1,
        include: { proveedor: { select: { id: true, razonSocial: true } } },
      },
    },
  })
  return items
    .filter((i) => i.stock <= i.stockMinimo)
    .map((i) => ({
      ...i,
      faltante: Math.max(i.stockMinimo - i.stock, 1),
      ultimoProveedor: i.proveedores[0]?.proveedor ?? null,
    }))
}
