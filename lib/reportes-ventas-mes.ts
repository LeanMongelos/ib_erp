import { startOfMonth, endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'

export async function obtenerFacturasVentasMesActual() {
  const ahora = new Date()
  const inicioMes = startOfMonth(ahora)
  const finMes = endOfMonth(ahora)

  return prisma.factura.findMany({
    where: {
      estado: { in: ['EMITIDA', 'PAGADA'] },
      fechaEmision: { gte: inicioMes, lte: finMes },
    },
    include: {
      cliente: { select: { nombre: true } },
      emisor: { select: { razonSocial: true } },
    },
    orderBy: [{ fechaEmision: 'asc' }, { numero: 'asc' }],
  })
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function ventasMesToCsv(
  facturas: Awaited<ReturnType<typeof obtenerFacturasVentasMesActual>>,
): string {
  const periodo = format(new Date(), 'MMMM yyyy', { locale: es })
  const headers = [
    'Numero',
    'Tipo',
    'Estado',
    'Fecha emision',
    'Cliente',
    'Emisor',
    'Subtotal',
    'IVA',
    'Total',
    'Moneda',
    'CAE',
  ]

  const rows = facturas.map((f) =>
    [
      f.numero,
      f.tipo,
      f.estado,
      format(f.fechaEmision, 'yyyy-MM-dd'),
      f.cliente.nombre,
      f.emisor?.razonSocial ?? '',
      f.subtotal.toFixed(2),
      f.iva.toFixed(2),
      f.total.toFixed(2),
      f.moneda,
      f.cae ?? '',
    ]
      .map(escCsv)
      .join(','),
  )

  const total = facturas.reduce((acc, f) => acc + f.total, 0)
  const meta = `# Ventas ${periodo} — ${facturas.length} factura(s) — total ${total.toFixed(2)}`

  return [meta, headers.join(','), ...rows].join('\n')
}
