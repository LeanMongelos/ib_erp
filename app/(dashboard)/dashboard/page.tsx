import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { OTsChart } from '@/components/dashboard/OTsChart'
import { RecentOTsTable } from '@/components/dashboard/RecentOTsTable'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, ShieldCheck, FileText, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatMonto } from '@/lib/utils'
import { actualizarOTsVencidas } from '@/lib/ots'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { requirePagePermissionAny } from '@/lib/page-guard'
import { DASHBOARD_ACCESS_PERMISSIONS } from '@/lib/page-permissions'

async function getDashboardData() {
  // Sincronizamos las OTs vencidas antes de calcular cualquier métrica
  await actualizarOTsVencidas()

  const ahora = new Date()

  const [
    otsAbiertas,
    otsVencidas,
    clientesActivos,
    facturasPendientes,
    equiposEnGarantia,
    ultimasOTs,
    otsCerradas,
  ] = await Promise.all([
    prisma.ordenTrabajo.count({ where: { estado: { in: ['ABIERTA', 'EN_PROCESO'] } } }),
    prisma.ordenTrabajo.count({ where: { estado: 'VENCIDA' } }),
    prisma.cliente.count({ where: { activo: true } }),
    prisma.factura.aggregate({ where: { estado: 'PENDIENTE' }, _sum: { total: true } }),
    prisma.equipo.count({ where: { garantiaHasta: { gte: ahora }, estado: { not: 'BAJA' } } }),
    prisma.ordenTrabajo.findMany({
      take: 5,
      orderBy: { creadoEn: 'desc' },
      include: { cliente: true, equipo: true, tecnico: true },
    }),
    prisma.ordenTrabajo.findMany({
      where: { estado: 'CERRADA', fechaCierre: { not: null } },
      select: { fechaCierre: true, slaVence: true },
    }),
  ])

  // Cumplimiento de SLA: % de OTs cerradas dentro del plazo comprometido
  const cerradasEnPlazo = otsCerradas.filter(
    (o) => o.fechaCierre && o.fechaCierre <= o.slaVence,
  ).length
  const cumplimientoSLA =
    otsCerradas.length > 0 ? Math.round((cerradasEnPlazo / otsCerradas.length) * 100) : 100

  // OTs por mes — últimos 6 meses
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

  // OTs por estado
  const estadosCounts = await prisma.ordenTrabajo.groupBy({
    by: ['estado'],
    _count: { _all: true },
  })

  return {
    otsAbiertas,
    otsVencidas,
    clientesActivos,
    facturasPendientesMonto: Number(facturasPendientes._sum.total ?? 0),
    equiposEnGarantia,
    cumplimientoSLA,
    ultimasOTs: JSON.parse(JSON.stringify(ultimasOTs)),
    otsPorMes,
    estadosCounts,
  }
}

export default async function DashboardPage() {
  await requirePagePermissionAny(...DASHBOARD_ACCESS_PERMISSIONS)
  const data = await getDashboardData()

  const estadoMap: Record<string, number> = Object.fromEntries(
    data.estadosCounts.map((s: { estado: string; _count: { _all: number } }) => [s.estado, s._count._all]),
  )

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Resumen general · ${format(new Date(), 'MMMM yyyy', { locale: es }).replace(/^\w/, (c) => c.toUpperCase())}`}
      />

      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6 flex flex-col gap-[18px]">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            title="Órdenes de Trabajo abiertas"
            value={data.otsAbiertas}
            icon={ClipboardList}
            variant="orange"
          />
          <KPICard
            title="Equipos en garantía"
            value={data.equiposEnGarantia}
            icon={ShieldCheck}
            variant="orange"
          />
          <KPICard
            title="Facturas pendientes"
            value={formatMonto(data.facturasPendientesMonto)}
            icon={FileText}
            variant="orange"
          />
          <KPICard
            title="Clientes activos"
            value={data.clientesActivos}
            icon={Users}
            variant="orange"
          />
        </div>

        {/* Gráficos */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.85fr 1fr' }}>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <CardTitle>Órdenes de Trabajo por mes</CardTitle>
              <span className="text-[11px] text-[#9aa1ab] font-medium">
                {new Date().getFullYear()}
              </span>
            </div>
            <OTsChart data={data.otsPorMes} />
          </Card>

          <Card>
            <CardTitle className="mb-4">OTs por estado</CardTitle>
            <div className="flex flex-col gap-3.5">
              {[
                { estado: 'Abiertas',      key: 'ABIERTA',    color: '#1D4ED8' },
                { estado: 'En proceso',    key: 'EN_PROCESO',  color: '#E8650A' },
                { estado: 'Vencidas',      key: 'VENCIDA',    color: '#C2261B' },
                { estado: 'Cerradas (mes)',key: 'CERRADA',    color: '#15803D' },
              ].map(({ estado, key, color }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-[12.5px] text-[#3a4150] font-medium">{estado}</span>
                  </div>
                  <span className="text-[13px] font-bold text-[#16181d]">
                    {estadoMap[key] ?? 0}
                  </span>
                </div>
              ))}
              <div className="h-px bg-[#f0f1f4] my-0.5" />
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[#7c828c] font-semibold">Cumplimiento SLA</span>
                <span
                  className={`text-[14px] font-extrabold ${
                    data.cumplimientoSLA >= 90
                      ? 'text-[#15803D]'
                      : data.cumplimientoSLA >= 75
                      ? 'text-[#E8650A]'
                      : 'text-[#C2261B]'
                  }`}
                >
                  {data.cumplimientoSLA}%
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Últimas OTs */}
        <Card padding={false} className="flex-1 overflow-hidden">
          <CardHeader>
            <CardTitle>Últimas órdenes de trabajo</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <RecentOTsTable ots={data.ultimasOTs} />
          </div>
        </Card>
      </div>
    </>
  )
}
