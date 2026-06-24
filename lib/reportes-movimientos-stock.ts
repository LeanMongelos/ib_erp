import { endOfDay, format, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'

export type RangoMovimientosStock = {
  desde: Date
  hasta: Date
}

export function parseRangoMovimientosStock(
  desdeStr: string | null,
  hastaStr: string | null,
): RangoMovimientosStock | { error: string } {
  const ahora = new Date()
  const defaultDesde = startOfDay(new Date(ahora.getFullYear(), ahora.getMonth(), 1))
  const defaultHasta = endOfDay(ahora)

  let desde = defaultDesde
  let hasta = defaultHasta

  if (desdeStr) {
    const parsed = parseISO(desdeStr)
    if (Number.isNaN(parsed.getTime())) {
      return { error: 'Parámetro "desde" inválido (use yyyy-MM-dd)' }
    }
    desde = startOfDay(parsed)
  }

  if (hastaStr) {
    const parsed = parseISO(hastaStr)
    if (Number.isNaN(parsed.getTime())) {
      return { error: 'Parámetro "hasta" inválido (use yyyy-MM-dd)' }
    }
    hasta = endOfDay(parsed)
  }

  if (desde.getTime() > hasta.getTime()) {
    return { error: '"desde" no puede ser posterior a "hasta"' }
  }

  return { desde, hasta }
}

export async function obtenerMovimientosStock(rango: RangoMovimientosStock) {
  return prisma.movimientoStock.findMany({
    where: {
      creadoEn: { gte: rango.desde, lte: rango.hasta },
    },
    include: {
      inventario: { select: { nombre: true, sku: true } },
      deposito: { select: { nombre: true } },
    },
    orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
  })
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function movimientosStockToCsv(
  movimientos: Awaited<ReturnType<typeof obtenerMovimientosStock>>,
  rango: RangoMovimientosStock,
): string {
  const headers = [
    'Fecha',
    'Tipo',
    'Producto',
    'SKU',
    'Deposito',
    'Cantidad',
    'Stock antes',
    'Stock despues',
    'Motivo',
    'Referencia',
  ]

  const rows = movimientos.map((m) =>
    [
      format(m.creadoEn, 'yyyy-MM-dd HH:mm'),
      m.tipo,
      m.inventario.nombre,
      m.inventario.sku ?? '',
      m.deposito?.nombre ?? '',
      m.cantidad,
      m.stockAntes,
      m.stockDespues,
      m.motivo ?? '',
      m.referencia ?? '',
    ]
      .map(escCsv)
      .join(','),
  )

  const labelDesde = format(rango.desde, 'yyyy-MM-dd')
  const labelHasta = format(rango.hasta, 'yyyy-MM-dd')
  const meta = `# Movimientos de stock ${labelDesde} a ${labelHasta} — ${movimientos.length} movimiento(s) (${format(new Date(), 'dd/MM/yyyy', { locale: es })})`

  return [meta, headers.join(','), ...rows].join('\n')
}
