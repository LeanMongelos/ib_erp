import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'

export async function generarReporteFiscal() {
  const ahora = new Date()
  const inicioMes = startOfMonth(ahora)
  const finMes = endOfMonth(ahora)

  const estadosFiscales = ['EMITIDA', 'PAGADA', 'PENDIENTE', 'VENCIDA', 'PENDIENTE_CAE'] as const

  const [facturasMes, facturasPorTipo, facturasPorEmisor, pendientesCae, rechazadas, anuladas] =
    await Promise.all([
      prisma.factura.aggregate({
        where: {
          fechaEmision: { gte: inicioMes, lte: finMes },
          estado: { in: [...estadosFiscales] },
        },
        _sum: { subtotal: true, iva: true, total: true },
        _count: { _all: true },
      }),
      prisma.factura.groupBy({
        by: ['tipo'],
        where: { estado: { in: [...estadosFiscales] } },
        _sum: { subtotal: true, iva: true, total: true },
        _count: { _all: true },
      }),
      prisma.factura.groupBy({
        by: ['emisorId'],
        where: {
          estado: { in: [...estadosFiscales] },
          emisorId: { not: null },
        },
        _sum: { subtotal: true, iva: true, total: true },
        _count: { _all: true },
      }),
      prisma.factura.count({ where: { estado: 'PENDIENTE_CAE' } }),
      prisma.factura.count({ where: { estado: 'RECHAZADA' } }),
      prisma.factura.count({ where: { estado: 'ANULADA' } }),
    ])

  const emisorIds = facturasPorEmisor.map((f) => f.emisorId!).filter(Boolean)
  const emisores = await prisma.emisor.findMany({
    where: { id: { in: emisorIds } },
    select: { id: true, razonSocial: true, cuit: true },
  })
  const emisorMap = new Map(emisores.map((e) => [e.id, e]))

  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(ahora, 5 - i)
    return { inicio: startOfMonth(d), fin: endOfMonth(d), label: format(d, 'MMM yy', { locale: es }) }
  })

  const ivaPorMes = await Promise.all(
    meses.map(async ({ inicio, fin, label }) => {
      const agg = await prisma.factura.aggregate({
        where: {
          fechaEmision: { gte: inicio, lte: fin },
          estado: { in: ['EMITIDA', 'PAGADA', 'PENDIENTE', 'VENCIDA'] },
        },
        _sum: { iva: true, subtotal: true, total: true },
        _count: { _all: true },
      })
      return {
        mes: label,
        iva: Number(agg._sum.iva ?? 0),
        neto: Number(agg._sum.subtotal ?? 0),
        total: Number(agg._sum.total ?? 0),
        cantidad: agg._count._all,
      }
    }),
  )

  const conCae = await prisma.factura.count({
    where: { cae: { not: null }, estado: { in: ['EMITIDA', 'PAGADA'] } },
  })

  return {
    periodo: format(ahora, 'MMMM yyyy', { locale: es }),
    mesActual: {
      cantidad: facturasMes._count._all,
      neto: Number(facturasMes._sum.subtotal ?? 0),
      iva: Number(facturasMes._sum.iva ?? 0),
      total: Number(facturasMes._sum.total ?? 0),
    },
    porTipo: facturasPorTipo.map((f) => ({
      tipo: f.tipo,
      cantidad: f._count._all,
      neto: Number(f._sum.subtotal ?? 0),
      iva: Number(f._sum.iva ?? 0),
      total: Number(f._sum.total ?? 0),
    })),
    porEmisor: facturasPorEmisor.map((f) => {
      const e = emisorMap.get(f.emisorId!)
      return {
        emisorId: f.emisorId,
        razonSocial: e?.razonSocial ?? '—',
        cuit: e?.cuit ?? '—',
        cantidad: f._count._all,
        neto: Number(f._sum.subtotal ?? 0),
        iva: Number(f._sum.iva ?? 0),
        total: Number(f._sum.total ?? 0),
      }
    }),
    ivaPorMes,
    alertas: {
      pendientesCae,
      rechazadas,
      anuladas,
      conCae,
    },
  }
}

export function reporteFiscalToCsv(data: Awaited<ReturnType<typeof generarReporteFiscal>>): string {
  const lines = [
    'Reporte Fiscal iBiomédica',
    `Período,${data.periodo}`,
    '',
    'Mes,Neto,IVA,Total,Cantidad',
    ...data.ivaPorMes.map((m) => `${m.mes},${m.neto},${m.iva},${m.total},${m.cantidad}`),
    '',
    'Tipo,Neto,IVA,Total,Cantidad',
    ...data.porTipo.map((t) => `${t.tipo},${t.neto},${t.iva},${t.total},${t.cantidad}`),
    '',
    'Emisor,CUIT,Neto,IVA,Total,Cantidad',
    ...data.porEmisor.map((e) => `"${e.razonSocial}",${e.cuit},${e.neto},${e.iva},${e.total},${e.cantidad}`),
  ]
  return lines.join('\n')
}
