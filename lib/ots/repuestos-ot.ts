/**
 * Repuestos OT — precios y stock en servidor.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { aplicarPreciosResueltosItems } from '@/lib/precios/aplicar-precios-documento'
import type { RepuestoOTInput } from '@/lib/ots/repuestos-ot-client'

export async function aplicarPreciosRepuestosOT(
  repuestos: RepuestoOTInput[],
  clienteId: string,
  moneda = 'ARS',
): Promise<RepuestoOTInput[]> {
  if (repuestos.length === 0) return repuestos

  const resueltos = await aplicarPreciosResueltosItems(
    repuestos.map((r) => ({
      descripcion: r.descripcion,
      cantidad: r.cantidad,
      precioUnit: r.precioUnit,
      inventarioId: r.inventarioId ?? null,
    })),
    { clienteId, moneda },
  )

  return repuestos.map((r, i) => ({
    ...r,
    precioUnit: resueltos[i]?.precioUnit ?? r.precioUnit,
  }))
}

export async function validarStockRepuestosOT(
  repuestos: RepuestoOTInput[],
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  for (const r of repuestos) {
    if (!r.inventarioId) continue
    const item = await db.inventario.findUnique({
      where: { id: r.inventarioId },
      select: { id: true, nombre: true, stock: true, activo: true },
    })
    if (!item || !item.activo) {
      throw new ApiError(404, `Ítem de inventario no encontrado para «${r.descripcion}»`)
    }
    if (item.stock < r.cantidad) {
      throw new ApiError(
        400,
        `Stock insuficiente para «${item.nombre}» (disponible: ${item.stock}, solicitado: ${r.cantidad})`,
      )
    }
  }
}
