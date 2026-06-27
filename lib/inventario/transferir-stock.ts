/**
 * Transferencia entre depósitos — bulk (StockDeposito) o serializado (InventarioUnidad).
 */

import { prisma } from '@/lib/prisma'
import { registrarMovimientoStock } from '@/lib/inventario'
import {
  trazabilidadActiva,
  transferirUnidadesSerializadas,
  transferirUnidadesPorIds,
  contarStockEnDeposito,
} from '@/lib/inventario/unidades'
import { transferirStockDepositoBulk } from '@/lib/inventario/stock-deposito'

export async function transferirStockEntreDepositos(opts: {
  inventarioId: string
  depositoOrigenId: string
  depositoDestinoId: string
  cantidad?: number
  unidadIds?: string[]
  motivo?: string
  usuarioId?: string
  ubicacionDetalleDestino?: string | null
}) {
  if (opts.depositoOrigenId === opts.depositoDestinoId) {
    throw new Error('El depósito de origen y destino deben ser distintos')
  }

  const cantidad =
    opts.unidadIds?.length ??
    opts.cantidad ??
    0
  if (cantidad <= 0) {
    throw new Error('Indicá la cantidad o seleccioná unidades para transferir')
  }

  const [item, origen, destino] = await Promise.all([
    prisma.inventario.findUnique({ where: { id: opts.inventarioId, activo: true } }),
    prisma.deposito.findFirst({ where: { id: opts.depositoOrigenId, activo: true } }),
    prisma.deposito.findFirst({ where: { id: opts.depositoDestinoId, activo: true } }),
  ])

  if (!item) throw new Error('Producto no encontrado')
  if (!origen || !destino) throw new Error('Depósito no encontrado o inactivo')

  const disponibleOrigen = await contarStockEnDeposito(opts.inventarioId, opts.depositoOrigenId)
  if (disponibleOrigen < cantidad) {
    throw new Error(`Stock insuficiente en origen (disponible: ${disponibleOrigen})`)
  }

  const motivo =
    opts.motivo?.trim() ||
    `Transferencia ${origen.nombre} → ${destino.nombre}`

  if (trazabilidadActiva(item.modoTrazabilidad)) {
    await prisma.$transaction(async (tx) => {
      if (opts.unidadIds?.length) {
        await transferirUnidadesPorIds(
          {
            inventarioId: opts.inventarioId,
            depositoOrigenId: opts.depositoOrigenId,
            depositoDestinoId: opts.depositoDestinoId,
            unidadIds: opts.unidadIds,
            ubicacionDetalleDestino: opts.ubicacionDetalleDestino,
          },
          tx,
        )
      } else {
        await transferirUnidadesSerializadas(
          {
            inventarioId: opts.inventarioId,
            depositoOrigenId: opts.depositoOrigenId,
            depositoDestinoId: opts.depositoDestinoId,
            cantidad,
            ubicacionDetalleDestino: opts.ubicacionDetalleDestino,
          },
          tx,
        )
      }
    })
  } else {
    await prisma.$transaction(async (tx) => {
      await transferirStockDepositoBulk(
        {
          inventarioId: opts.inventarioId,
          depositoOrigenId: opts.depositoOrigenId,
          depositoDestinoId: opts.depositoDestinoId,
          cantidad,
          ubicacionDetalleDestino: opts.ubicacionDetalleDestino,
        },
        tx,
      )
    })
  }

  return registrarMovimientoStock({
    inventarioId: opts.inventarioId,
    tipo: 'TRANSFERENCIA',
    cantidad,
    depositoId: opts.depositoDestinoId,
    motivo,
    referencia: `transfer:${opts.depositoOrigenId}:${opts.depositoDestinoId}`,
    usuarioId: opts.usuarioId,
    actualizarStock: false,
  })
}
