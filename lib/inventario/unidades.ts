/**
 * Unidades de inventario (SN/Lote) y sincronización de stock agregado.
 */
import type { ModoTrazabilidad, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'

type DbClient = Prisma.TransactionClient | typeof prisma

export function trazabilidadActiva(modo: ModoTrazabilidad): boolean {
  return modo !== 'NINGUNA'
}

export function requiereSerie(modo: ModoTrazabilidad): boolean {
  return modo === 'SERIE' || modo === 'SERIE_Y_LOTE'
}

export function requiereLote(modo: ModoTrazabilidad): boolean {
  return modo === 'LOTE' || modo === 'SERIE_Y_LOTE'
}

export async function validarDepositoActivo(depositoId: string | null | undefined, db?: DbClient) {
  if (!depositoId) return null
  const client = db ?? prisma
  const deposito = await client.deposito.findFirst({
    where: { id: depositoId, activo: true },
    select: { id: true },
  })
  if (!deposito) throw new ApiError(404, 'Depósito no encontrado o inactivo')
  return deposito.id
}

export async function sincronizarStockDesdeUnidades(inventarioId: string, db?: DbClient) {
  const client = db ?? prisma
  const inv = await client.inventario.findUnique({
    where: { id: inventarioId },
    select: { id: true, modoTrazabilidad: true },
  })
  if (!inv || !trazabilidadActiva(inv.modoTrazabilidad)) return

  const enStock = await client.inventarioUnidad.count({
    where: { inventarioId, estado: 'EN_STOCK' },
  })

  await client.inventario.update({
    where: { id: inventarioId },
    data: { stock: enStock },
  })
}

export async function validarUnidadNueva(
  inventarioId: string,
  data: {
    numeroSerie?: string | null
    lote?: string | null
    depositoId?: string | null
  },
  db?: DbClient,
) {
  const client = db ?? prisma
  const inv = await client.inventario.findUnique({ where: { id: inventarioId } })
  if (!inv) throw new ApiError(404, 'Producto no encontrado')
  if (!trazabilidadActiva(inv.modoTrazabilidad)) {
    throw new ApiError(400, 'Este producto no tiene trazabilidad por unidad habilitada')
  }

  const serie = data.numeroSerie?.trim() || null

  if (serie) {
    const dup = await client.inventarioUnidad.findFirst({
      where: { inventarioId, numeroSerie: serie },
      select: { id: true },
    })
    if (dup) throw new ApiError(409, `Ya existe una unidad con el número de serie «${serie}» en este producto`)
  }

  await validarDepositoActivo(data.depositoId, client)

  return inv
}

export async function marcarUnidadVendida(
  unidadId: string,
  opts: { equipoId: string; reservar?: boolean },
  db?: DbClient,
) {
  const client = db ?? prisma
  const unidad = await client.inventarioUnidad.findUnique({ where: { id: unidadId } })
  if (!unidad) throw new ApiError(404, 'Unidad de inventario no encontrada')
  if (unidad.estado === 'VENDIDO') {
    throw new ApiError(400, 'La unidad de inventario ya fue vendida')
  }
  if (unidad.estado === 'BAJA') {
    throw new ApiError(400, 'La unidad de inventario está dada de baja')
  }

  await client.inventarioUnidad.update({
    where: { id: unidadId },
    data: {
      estado: 'VENDIDO',
      equipoId: opts.equipoId,
    },
  })

  await sincronizarStockDesdeUnidades(unidad.inventarioId, client)
}

export async function reservarUnidadParaFactura(unidadId: string, db?: DbClient) {
  const client = db ?? prisma
  const unidad = await client.inventarioUnidad.findUnique({ where: { id: unidadId } })
  if (!unidad) throw new ApiError(404, 'Unidad de inventario no encontrada')
  if (unidad.estado !== 'EN_STOCK') {
    throw new ApiError(400, 'La unidad seleccionada no está disponible en stock')
  }

  await client.inventarioUnidad.update({
    where: { id: unidadId },
    data: { estado: 'RESERVADO' },
  })

  await sincronizarStockDesdeUnidades(unidad.inventarioId, client)
}

export async function liberarUnidadReservada(unidadId: string, db?: DbClient) {
  const client = db ?? prisma
  const unidad = await client.inventarioUnidad.findUnique({ where: { id: unidadId } })
  if (!unidad || unidad.estado !== 'RESERVADO') return

  await client.inventarioUnidad.update({
    where: { id: unidadId },
    data: { estado: 'EN_STOCK' },
  })

  await sincronizarStockDesdeUnidades(unidad.inventarioId, client)
}

export async function transferirUnidadesSerializadas(
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

  const enOrigen = await client.inventarioUnidad.findMany({
    where: {
      inventarioId: opts.inventarioId,
      estado: 'EN_STOCK',
      depositoId: opts.depositoOrigenId,
    },
    orderBy: { fechaIngreso: 'asc' },
    take: opts.cantidad,
    select: { id: true },
  })

  const ids = enOrigen.map((u) => u.id)
  if (ids.length < opts.cantidad) {
    const faltan = opts.cantidad - ids.length
    const sinDeposito = await client.inventarioUnidad.findMany({
      where: {
        inventarioId: opts.inventarioId,
        estado: 'EN_STOCK',
        depositoId: null,
        ...(ids.length ? { id: { notIn: ids } } : {}),
      },
      orderBy: { fechaIngreso: 'asc' },
      take: faltan,
      select: { id: true },
    })
    ids.push(...sinDeposito.map((u) => u.id))
  }

  if (ids.length < opts.cantidad) {
    throw new ApiError(
      400,
      `Unidades insuficientes en el depósito de origen (disponibles: ${ids.length})`,
    )
  }

  await client.inventarioUnidad.updateMany({
    where: { id: { in: ids } },
    data: {
      depositoId: opts.depositoDestinoId,
      ubicacionDetalle: opts.ubicacionDetalleDestino?.trim() || null,
    },
  })
}
