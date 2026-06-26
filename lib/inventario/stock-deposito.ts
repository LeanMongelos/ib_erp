/**
 * Stock por depósito (artículos sin trazabilidad por unidad).
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'

type DbClient = Prisma.TransactionClient | typeof prisma

export async function reconcileInventarioStock(inventarioId: string, db?: DbClient) {
  const client = db ?? prisma
  const rows = await client.stockDeposito.findMany({
    where: { inventarioId },
    select: { cantidad: true },
  })
  if (rows.length === 0) return

  const total = rows.reduce((sum, r) => sum + r.cantidad, 0)
  await client.inventario.update({
    where: { id: inventarioId },
    data: { stock: total },
  })
}

export async function ajustarStockDeposito(
  opts: {
    inventarioId: string
    depositoId: string
    delta: number
    ubicacionDetalle?: string | null
  },
  db?: DbClient,
) {
  const client = db ?? prisma

  const deposito = await client.deposito.findFirst({
    where: { id: opts.depositoId, activo: true },
    select: { id: true },
  })
  if (!deposito) throw new ApiError(404, 'Depósito no encontrado o inactivo')

  const existente = await client.stockDeposito.findUnique({
    where: {
      inventarioId_depositoId: {
        inventarioId: opts.inventarioId,
        depositoId: opts.depositoId,
      },
    },
  })

  const cantidadNueva = (existente?.cantidad ?? 0) + opts.delta
  if (cantidadNueva < 0) {
    throw new ApiError(
      400,
      `Stock insuficiente en el depósito (disponible: ${existente?.cantidad ?? 0})`,
    )
  }

  if (existente) {
    await client.stockDeposito.update({
      where: { id: existente.id },
      data: {
        cantidad: cantidadNueva,
        ...(opts.ubicacionDetalle !== undefined
          ? { ubicacionDetalle: opts.ubicacionDetalle?.trim() || null }
          : {}),
      },
    })
  } else if (opts.delta > 0) {
    await client.stockDeposito.create({
      data: {
        inventarioId: opts.inventarioId,
        depositoId: opts.depositoId,
        cantidad: opts.delta,
        ubicacionDetalle: opts.ubicacionDetalle?.trim() || null,
      },
    })
  } else {
    throw new ApiError(400, 'Stock insuficiente en el depósito (disponible: 0)')
  }

  await reconcileInventarioStock(opts.inventarioId, client)
}

export async function transferirStockDepositoBulk(
  opts: {
    inventarioId: string
    depositoOrigenId: string
    depositoDestinoId: string
    cantidad: number
    ubicacionDetalleDestino?: string | null
  },
  db?: DbClient,
) {
  const client = db ?? prisma
  await ajustarStockDeposito(
    {
      inventarioId: opts.inventarioId,
      depositoId: opts.depositoOrigenId,
      delta: -opts.cantidad,
    },
    client,
  )
  await ajustarStockDeposito(
    {
      inventarioId: opts.inventarioId,
      depositoId: opts.depositoDestinoId,
      delta: opts.cantidad,
      ubicacionDetalle: opts.ubicacionDetalleDestino,
    },
    client,
  )
}
