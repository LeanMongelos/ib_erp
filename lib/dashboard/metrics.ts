/**
 * Métricas del dashboard filtradas por permiso (RBAC fino).
 * Un técnico con solo servicio.read no recibe KPIs financieros en SSR ni en la API.
 */

import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import { actualizarOTsVencidas } from '@/lib/ots'
import { tienePermiso } from '@/lib/rbac'
import type { OrdenTrabajo } from '@/types'

export type DashboardVisibility = {
  servicio: boolean
  clientes: boolean
  facturas: boolean
  presupuestos: boolean
}

export type DashboardMetrics = {
  visibility: DashboardVisibility
  otsAbiertas: number | null
  otsVencidas: number | null
  clientesActivos: number | null
  facturasPendientesMonto: number | null
  ventasMesActual: number | null
  presupuestosPendientes: number | null
  cuotasVencidas: number | null
  equiposEnGarantia: number | null
  cumplimientoSLA: number | null
  ultimasOTs: OrdenTrabajo[] | null
  otsPorMes: { mes: string; cantidad: number }[] | null
  estadosCounts: { estado: string; _count: { _all: number } }[] | null
}

export function getDashboardVisibility(permissions: string[]): DashboardVisibility {
  return {
    servicio: tienePermiso(permissions, 'servicio.read'),
    clientes: tienePermiso(permissions, 'clientes.read'),
    facturas:
      tienePermiso(permissions, 'facturas.read') ||
      tienePermiso(permissions, 'cobranzas.read'),
    presupuestos: tienePermiso(permissions, 'presupuestos.read'),
  }
}

export async function getDashboardMetrics(permissions: string[]): Promise<DashboardMetrics> {
  const visibility = getDashboardVisibility(permissions)
  const empty: DashboardMetrics = {
    visibility,
    otsAbiertas: null,
    otsVencidas: null,
    clientesActivos: null,
    facturasPendientesMonto: null,
    ventasMesActual: null,
    presupuestosPendientes: null,
    cuotasVencidas: null,
    equiposEnGarantia: null,
    cumplimientoSLA: null,
    ultimasOTs: null,
    otsPorMes: null,
    estadosCounts: null,
  }

  if (!visibility.servicio && !visibility.clientes && !visibility.facturas && !visibility.presupuestos) {
    return empty
  }

  if (visibility.servicio) {
    await actualizarOTsVencidas()
  }

  const ahora = new Date()
  const inicioMes = startOfMonth(ahora)
  const finMes = endOfMonth(ahora)

  const [
    otsAbiertas,
    otsVencidas,
    clientesActivos,
    facturasPendientes,
    ventasMesActual,
    presupuestosPendientes,
    cuotasVencidas,
    equiposEnGarantia,
    ultimasOTs,
    otsCerradas,
  ] = await Promise.all([
    visibility.servicio
      ? prisma.ordenTrabajo.count({ where: { estado: { in: ['ABIERTA', 'EN_PROCESO'] } } })
      : Promise.resolve(null),
    visibility.servicio
      ? prisma.ordenTrabajo.count({ where: { estado: 'VENCIDA' } })
      : Promise.resolve(null),
    visibility.clientes
      ? prisma.cliente.count({ where: { activo: true } })
      : Promise.resolve(null),
    visibility.facturas
      ? prisma.factura.aggregate({
          where: { estado: { in: ['PENDIENTE', 'EMITIDA', 'VENCIDA'] } },
          _sum: { total: true },
        })
      : Promise.resolve(null),
    visibility.facturas
      ? prisma.factura.aggregate({
          where: {
            estado: { in: ['EMITIDA', 'PAGADA'] },
            fechaEmision: { gte: inicioMes, lte: finMes },
          },
          _sum: { total: true },
        })
      : Promise.resolve(null),
    visibility.presupuestos
      ? prisma.presupuesto.count({
          where: { estado: { in: ['ENVIADO', 'APROBADO'] } },
        })
      : Promise.resolve(null),
    visibility.facturas
      ? prisma.vencimientoCobranza.count({
          where: {
            estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
            fechaVencimiento: { lt: ahora },
            factura: { estado: { in: ['EMITIDA', 'VENCIDA', 'PENDIENTE'] } },
          },
        })
      : Promise.resolve(null),
    visibility.servicio
      ? prisma.equipo.count({
          where: { garantiaHasta: { gte: ahora }, estado: { not: 'BAJA' } },
        })
      : Promise.resolve(null),
    visibility.servicio
      ? prisma.ordenTrabajo.findMany({
          take: 5,
          orderBy: { creadoEn: 'desc' },
          include: { cliente: true, equipo: true, tecnico: true },
        })
      : Promise.resolve(null),
    visibility.servicio
      ? prisma.ordenTrabajo.findMany({
          where: { estado: 'CERRADA', fechaCierre: { not: null } },
          select: { fechaCierre: true, slaVence: true },
        })
      : Promise.resolve(null),
  ])

  let cumplimientoSLA: number | null = null
  if (visibility.servicio && otsCerradas) {
    const cerradasEnPlazo = otsCerradas.filter(
      (o) => o.fechaCierre && o.fechaCierre <= o.slaVence,
    ).length
    cumplimientoSLA =
      otsCerradas.length > 0
        ? Math.round((cerradasEnPlazo / otsCerradas.length) * 100)
        : 100
  }

  let otsPorMes: { mes: string; cantidad: number }[] | null = null
  if (visibility.servicio) {
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(ahora, 5 - i)
      return { inicio: startOfMonth(d), fin: endOfMonth(d), label: format(d, 'MMM', { locale: es }) }
    })
    otsPorMes = await Promise.all(
      meses.map(async ({ inicio, fin, label }) => ({
        mes: label.charAt(0).toUpperCase() + label.slice(1),
        cantidad: await prisma.ordenTrabajo.count({
          where: { creadoEn: { gte: inicio, lte: fin } },
        }),
      })),
    )
  }

  const estadosCounts = visibility.servicio
    ? await prisma.ordenTrabajo.groupBy({
        by: ['estado'],
        _count: { _all: true },
      })
    : null

  return {
    visibility,
    otsAbiertas,
    otsVencidas,
    clientesActivos,
    facturasPendientesMonto: facturasPendientes
      ? Number(facturasPendientes._sum.total ?? 0)
      : null,
    ventasMesActual: ventasMesActual ? Number(ventasMesActual._sum.total ?? 0) : null,
    presupuestosPendientes,
    cuotasVencidas,
    equiposEnGarantia,
    cumplimientoSLA,
    ultimasOTs: ultimasOTs
      ? (JSON.parse(JSON.stringify(ultimasOTs)) as OrdenTrabajo[])
      : null,
    otsPorMes,
    estadosCounts,
  }
}
