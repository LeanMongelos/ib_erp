import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import { actualizarOTsVencidas } from '@/lib/ots'
import { calcularMetricasCliente } from '@/lib/clientes-metrics'

export async function generarResumenReportes() {
  await actualizarOTsVencidas()
  const ahora = new Date()

  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(ahora, 5 - i)
    return { inicio: startOfMonth(d), fin: endOfMonth(d), label: format(d, 'MMM yy', { locale: es }) }
  })

  const [
    facturasPorMes,
    presupuestosPorEstado,
    facturasPorEstado,
    topClientesRaw,
    otsPorEstado,
    productosBajoMinimo,
    conversacionesAbiertas,
    clientesConFacturas,
  ] = await Promise.all([
    Promise.all(
      meses.map(async ({ inicio, fin, label }) => {
        const agg = await prisma.factura.aggregate({
          where: {
            fechaEmision: { gte: inicio, lte: fin },
            estado: { in: ['EMITIDA', 'PAGADA', 'PENDIENTE', 'VENCIDA', 'PENDIENTE_CAE'] },
          },
          _sum: { total: true },
          _count: { _all: true },
        })
        return { mes: label, monto: Number(agg._sum.total ?? 0), cantidad: agg._count._all }
      }),
    ),
    prisma.presupuesto.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.factura.groupBy({ by: ['estado'], _count: { _all: true }, _sum: { total: true } }),
    prisma.factura.groupBy({
      by: ['clienteId'],
      where: { estado: { in: ['EMITIDA', 'PAGADA', 'PENDIENTE', 'VENCIDA'] } },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
    prisma.ordenTrabajo.groupBy({ by: ['estado'], _count: { _all: true } }),
    prisma.inventario.findMany({
      select: { id: true, nombre: true, stock: true, stockMinimo: true },
      where: { activo: true },
      orderBy: { stock: 'asc' },
      take: 50,
    }),
    prisma.conversacionCRM.count({ where: { estado: { in: ['ABIERTA', 'PENDIENTE'] } } }),
    prisma.cliente.findMany({
      where: { facturas: { some: { estado: { notIn: ['BORRADOR', 'ANULADA'] } } } },
      include: {
        facturas: {
          where: { estado: { notIn: ['BORRADOR', 'ANULADA'] } },
          select: { estado: true, total: true, fechaEmision: true, fechaVencimiento: true },
        },
      },
    }),
  ])

  const clienteIds = topClientesRaw.map((c) => c.clienteId)
  const nombresClientes = await prisma.cliente.findMany({
    where: { id: { in: clienteIds } },
    select: { id: true, nombre: true },
  })
  const nombreMap = new Map(nombresClientes.map((c) => [c.id, c.nombre]))

  const topClientes = topClientesRaw.map((c) => ({
    clienteId: c.clienteId,
    nombre: nombreMap.get(c.clienteId) ?? '—',
    total: Number(c._sum.total ?? 0),
  }))

  const segmentos: Record<string, number> = {}
  for (const c of clientesConFacturas) {
    const m = calcularMetricasCliente(
      c.facturas.map((f) => ({
        estado: f.estado,
        total: Number(f.total),
        fechaEmision: f.fechaEmision,
        fechaVencimiento: f.fechaVencimiento,
      })),
    )
    segmentos[m.segmento] = (segmentos[m.segmento] ?? 0) + 1
  }

  const deudaTotal = facturasPorEstado
    .filter((f) => ['PENDIENTE', 'VENCIDA', 'EMITIDA', 'PENDIENTE_CAE'].includes(f.estado))
    .reduce((acc, f) => acc + Number(f._sum.total ?? 0), 0)

  const inventarioBajoMinimo = productosBajoMinimo
    .filter((p) => p.stock <= p.stockMinimo)
    .slice(0, 10)
    .map((p) => ({ id: p.id, nombre: p.nombre, stock: p.stock, stockMinimo: p.stockMinimo }))

  return {
    comercial: {
      facturasPorMes,
      presupuestosPorEstado: presupuestosPorEstado.map((p) => ({
        estado: p.estado,
        cantidad: p._count._all,
      })),
      topClientes,
      segmentos,
    },
    financiero: {
      facturasPorEstado: facturasPorEstado.map((f) => ({
        estado: f.estado,
        cantidad: f._count._all,
        monto: Number(f._sum.total ?? 0),
      })),
      deudaTotal,
    },
    operativo: {
      otsPorEstado: otsPorEstado.map((o) => ({ estado: o.estado, cantidad: o._count._all })),
      productosBajoMinimo: inventarioBajoMinimo,
      conversacionesAbiertas,
    },
  }
}
