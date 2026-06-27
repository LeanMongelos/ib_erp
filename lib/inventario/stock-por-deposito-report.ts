/**
 * Consulta de stock desglosado por depósito (bulk + serializado).
 */
import { prisma } from '@/lib/prisma'
import { trazabilidadActiva } from '@/lib/inventario/unidades'

export type FilaStockDeposito = {
  inventarioId: string
  productoNombre: string
  sku: string | null
  modoTrazabilidad: string
  depositoId: string | null
  depositoNombre: string
  cantidad: number
  ubicacionDetalle: string | null
  unidadId?: string
  numeroSerie?: string | null
  lote?: string | null
}

export async function consultarStockPorDeposito(opts?: {
  depositoId?: string | null
  inventarioId?: string | null
}): Promise<FilaStockDeposito[]> {
  const depositoFilter = opts?.depositoId?.trim() || null
  const inventarioFilter = opts?.inventarioId?.trim() || null

  const inventarios = await prisma.inventario.findMany({
    where: {
      activo: true,
      ...(inventarioFilter ? { id: inventarioFilter } : {}),
    },
    select: { id: true, nombre: true, sku: true, modoTrazabilidad: true },
    orderBy: { nombre: 'asc' },
  })

  const filas: FilaStockDeposito[] = []

  for (const inv of inventarios) {
    if (trazabilidadActiva(inv.modoTrazabilidad)) {
      const unidades = await prisma.inventarioUnidad.findMany({
        where: {
          inventarioId: inv.id,
          estado: 'EN_STOCK',
          ...(depositoFilter ? { depositoId: depositoFilter } : {}),
        },
        include: { deposito: { select: { id: true, nombre: true } } },
        orderBy: [{ depositoId: 'asc' }, { numeroSerie: 'asc' }],
      })

      for (const u of unidades) {
        filas.push({
          inventarioId: inv.id,
          productoNombre: inv.nombre,
          sku: inv.sku,
          modoTrazabilidad: inv.modoTrazabilidad,
          depositoId: u.depositoId,
          depositoNombre: u.deposito?.nombre ?? 'Sin depósito',
          cantidad: 1,
          ubicacionDetalle: u.ubicacionDetalle,
          unidadId: u.id,
          numeroSerie: u.numeroSerie,
          lote: u.lote,
        })
      }
    } else {
      const stocks = await prisma.stockDeposito.findMany({
        where: {
          inventarioId: inv.id,
          cantidad: { gt: 0 },
          ...(depositoFilter ? { depositoId: depositoFilter } : {}),
        },
        include: { deposito: { select: { id: true, nombre: true } } },
        orderBy: { deposito: { nombre: 'asc' } },
      })

      for (const s of stocks) {
        filas.push({
          inventarioId: inv.id,
          productoNombre: inv.nombre,
          sku: inv.sku,
          modoTrazabilidad: inv.modoTrazabilidad,
          depositoId: s.depositoId,
          depositoNombre: s.deposito.nombre,
          cantidad: s.cantidad,
          ubicacionDetalle: s.ubicacionDetalle,
        })
      }
    }
  }

  return filas.sort((a, b) => {
    const dep = a.depositoNombre.localeCompare(b.depositoNombre, 'es')
    if (dep !== 0) return dep
    return a.productoNombre.localeCompare(b.productoNombre, 'es')
  })
}

export function filasStockACsv(filas: FilaStockDeposito[]): string {
  const header = [
    'Depósito',
    'Producto',
    'Código interno',
    'Cantidad',
    'Ubicación',
    'N° serie',
    'Lote',
    'Trazabilidad',
  ]
  const rows = filas.map((f) => [
    f.depositoNombre,
    f.productoNombre,
    f.sku ?? '',
    String(f.cantidad),
    f.ubicacionDetalle ?? '',
    f.numeroSerie ?? '',
    f.lote ?? '',
    f.modoTrazabilidad,
  ])
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
}
