/**
 * Transferencia auditiva entre depósitos (stock global sin cambio).
 * El inventario aún no modela stock por ubicación; el movimiento queda trazado.
 */

import { prisma } from '@/lib/prisma'
import { registrarMovimientoStock } from '@/lib/inventario'

export async function transferirStockEntreDepositos(opts: {
  inventarioId: string
  depositoOrigenId: string
  depositoDestinoId: string
  cantidad: number
  motivo?: string
  usuarioId?: string
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
