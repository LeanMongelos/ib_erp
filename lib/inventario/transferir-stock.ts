/**
 * Transferencia entre depósitos — bulk (StockDeposito) o serializado (InventarioUnidad).
 */

import { prisma } from '@/lib/prisma'
import { registrarMovimientoStock } from '@/lib/inventario'
import { trazabilidadActiva, transferirUnidadesSerializadas } from '@/lib/inventario/unidades'
import { transferirStockDepositoBulk } from '@/lib/inventario/stock-deposito'

export async function transferirStockEntreDepositos(opts: {
  inventarioId: string
  depositoOrigenId: string
  depositoDestinoId: string
  cantidad: number
  motivo?: string
  usuarioId?: string
  ubicacionDetalleDestino?: string | null
}) {
  if (opts.depositoOrigenId === opts.depositoDestinoId) {
    throw new Error('El depósito de origen y destino deben ser distintos')
  }

  const [item, origen, destino] = await Promise.all([
    prisma.inventario.findUnique({ where: { id: opts.inventarioId, activo: true } }),
    prisma.deposito.findFirst({ where: { id: opts.depositoOrigenId, activo: true } }),
    prisma.deposito.findFirst({ where: { id: opts.depositoDestinoId, activo: true } }),
  ])

  if (!item) throw new Error('Producto no encontrado')
  if (!origen || !destino) throw new Error('Depósito no encontrado o inactivo')
  if (item.stock < opts.cantidad) {
    throw new Error(`Stock insuficiente (disponible: ${item.stock})`)
  }

  const motivo =
    opts.motivo?.trim() ||
    `Transferencia ${origen.nombre} → ${destino.nombre}`

  if (trazabilidadActiva(item.modoTrazabilidad)) {
    await prisma.$transaction(async (tx) => {
      await transferirUnidadesSerializadas(
        {
          inventarioId: opts.inventarioId,
          depositoOrigenId: opts.depositoOrigenId,
          depositoDestinoId: opts.depositoDestinoId,
          cantidad: opts.cantidad,
          ubicacionDetalleDestino: opts.ubicacionDetalleDestino,
        },
        tx,
      )
    })
  } else {
    await prisma.$transaction(async (tx) => {
      await transferirStockDepositoBulk(
        {
          inventarioId: opts.inventarioId,
          depositoOrigenId: opts.depositoOrigenId,
          depositoDestinoId: opts.depositoDestinoId,
          cantidad: opts.cantidad,
          ubicacionDetalleDestino: opts.ubicacionDetalleDestino,
        },
        tx,
      )
    })
  }

  return registrarMovimientoStock({
    inventarioId: opts.inventarioId,
    tipo: 'TRANSFERENCIA',
    cantidad: opts.cantidad,
    depositoId: opts.depositoDestinoId,
    motivo,
    referencia: `transfer:${opts.depositoOrigenId}:${opts.depositoDestinoId}`,
    usuarioId: opts.usuarioId,
  })
}
