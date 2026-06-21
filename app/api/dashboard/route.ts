import { NextResponse } from 'next/server'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { actualizarOTsVencidas } from '@/lib/ots'

export async function GET() {
  try {
    await requireAuth()
    await actualizarOTsVencidas()

    const ahora = new Date()

    const [
      otsAbiertas,
      otsVencidas,
      clientesActivos,
      facturasPendientes,
      equiposEnGarantia,
    ] = await Promise.all([
      prisma.ordenTrabajo.count({ where: { estado: { in: ['ABIERTA', 'EN_PROCESO'] } } }),
      prisma.ordenTrabajo.count({ where: { estado: 'VENCIDA' } }),
      prisma.cliente.count({ where: { activo: true } }),
      prisma.factura.aggregate({ where: { estado: 'PENDIENTE' }, _sum: { total: true } }),
      prisma.equipo.count({ where: { garantiaHasta: { gte: ahora }, estado: { not: 'BAJA' } } }),
    ])

    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(ahora, 5 - i)
      return { inicio: startOfMonth(d), fin: endOfMonth(d), label: format(d, 'MMM', { locale: es }) }
    })

    const otsPorMes = await Promise.all(
      meses.map(async ({ inicio, fin, label }) => ({
        mes: label.charAt(0).toUpperCase() + label.slice(1),
        cantidad: await prisma.ordenTrabajo.count({
          where: { creadoEn: { gte: inicio, lte: fin } },
        }),
      })),
    )

    return NextResponse.json({
      otsAbiertas,
      otsVencidas,
      clientesActivos,
      facturasPendientesMonto: Number(facturasPendientes._sum.total ?? 0),
      equiposEnGarantia,
      otsPorMes,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
