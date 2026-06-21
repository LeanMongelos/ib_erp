/**
 * lib/inventario.ts — movimientos de stock y alertas de faltante.
 */

import { prisma } from '@/lib/prisma'

export async function registrarMovimientoStock(opts: {
  inventarioId: string
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'TRANSFERENCIA'
  cantidad: number
  motivo?: string
  referencia?: string
  depositoId?: string
  usuarioId?: string
}) {
  const item = await prisma.inventario.findUnique({ where: { id: opts.inventarioId } })
  if (!item) throw new Error('Ítem de inventario no encontrado')

  const delta = opts.tipo === 'SALIDA' ? -opts.cantidad : opts.cantidad
  const stockAntes = item.stock
  const stockDespues = stockAntes + delta

  const [mov] = await prisma.$transaction([
    prisma.movimientoStock.create({
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
    }),
    prisma.inventario.update({
      where: { id: opts.inventarioId },
      data: { stock: stockDespues },
    }),
  ])
  return mov
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
