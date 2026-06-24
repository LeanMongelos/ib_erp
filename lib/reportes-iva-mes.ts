import { startOfMonth, endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'

export async function obtenerVentasIvaMesActual() {
  const ahora = new Date()
  const inicio = startOfMonth(ahora)
  const fin = endOfMonth(ahora)

  const items = await prisma.itemFactura.findMany({
    where: {
      factura: {
        fechaEmision: { gte: inicio, lte: fin },
        estado: { in: ['EMITIDA', 'PAGADA', 'PENDIENTE', 'VENCIDA'] },
      },
    },
    select: {
      descripcion: true,
      cantidad: true,
      subtotal: true,
      alicuotaIvaPct: true,
      factura: {
        select: {
          numero: true,
          tipo: true,
          cliente: { select: { nombre: true } },
        },
      },
    },
    orderBy: { facturaId: 'asc' },
  })

  const porAlicuota = new Map<number, { neto: number; iva: number; cantidad: number }>()
  for (const it of items) {
    const pct = it.alicuotaIvaPct ?? 21
    const ivaLinea = it.subtotal * (pct / 100)
    const agg = porAlicuota.get(pct) ?? { neto: 0, iva: 0, cantidad: 0 }
    agg.neto += it.subtotal
    agg.iva += ivaLinea
    agg.cantidad += it.cantidad
    porAlicuota.set(pct, agg)
  }

  return { items, porAlicuota, periodo: format(ahora, 'MMMM yyyy', { locale: es }) }
}

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function ivaMesToCsv(data: Awaited<ReturnType<typeof obtenerVentasIvaMesActual>>): string {
  const headers = ['Factura', 'Tipo', 'Cliente', 'Descripcion', 'Cantidad', 'Alicuota IVA %', 'Neto', 'IVA']

  const rows = data.items.map((it) => {
    const pct = it.alicuotaIvaPct ?? 21
    const ivaLinea = it.subtotal * (pct / 100)
    return [
      it.factura.numero,
      it.factura.tipo,
      it.factura.cliente.nombre,
      it.descripcion,
      it.cantidad,
      pct,
      it.subtotal.toFixed(2),
      ivaLinea.toFixed(2),
    ]
      .map(escCsv)
      .join(',')
  })

  const resumen = [...data.porAlicuota.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pct, agg]) => `# Alicuota ${pct}% — ítems ${agg.cantidad} — neto ${agg.neto.toFixed(2)} — IVA ${agg.iva.toFixed(2)}`)

  const meta = `# IVA ventas ${data.periodo} — ${data.items.length} línea(s) de factura`
  return [meta, ...resumen, '', headers.join(','), ...rows].join('\n')
}
