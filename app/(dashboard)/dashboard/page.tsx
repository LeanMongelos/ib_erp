import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { OTsChart } from '@/components/dashboard/OTsChart'
import { RecentOTsTable } from '@/components/dashboard/RecentOTsTable'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, ShieldCheck, FileText, Users } from 'lucide-react'
import { formatMonto } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { requirePagePermissionAny } from '@/lib/page-guard'
import { DASHBOARD_ACCESS_PERMISSIONS } from '@/lib/page-permissions'
import { getDashboardMetrics } from '@/lib/dashboard/metrics'

export default async function DashboardPage() {
  const user = await requirePagePermissionAny(...DASHBOARD_ACCESS_PERMISSIONS)
  const data = await getDashboardMetrics(user.permissions)
  const { visibility } = data

  const estadoMap: Record<string, number> = data.estadosCounts
    ? Object.fromEntries(
        data.estadosCounts.map((s) => [s.estado, s._count._all]),
      )
    : {}

  const kpiCount =
    (visibility.servicio ? 2 : 0) +
    (visibility.facturas ? 1 : 0) +
    (visibility.clientes ? 1 : 0)

  const tieneMetricas = kpiCount > 0 || visibility.servicio

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Resumen general · ${format(new Date(), 'MMMM yyyy', { locale: es }).replace(/^\w/, (c) => c.toUpperCase())}`}
      />

      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6 flex flex-col gap-[18px]">
        {!tieneMetricas && (
          <Card>
            <p className="text-[13px] text-[#7c828c]">
              No tenés métricas asignadas para este panel. Contactá a un administrador si necesitás acceso adicional.
            </p>
          </Card>
        )}

        {kpiCount > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {visibility.servicio && data.otsAbiertas !== null && (
              <KPICard
                title="Órdenes de Trabajo abiertas"
                value={data.otsAbiertas}
                icon={ClipboardList}
                variant="orange"
              />
            )}
            {visibility.servicio && data.equiposEnGarantia !== null && (
              <KPICard
                title="Equipos en garantía"
                value={data.equiposEnGarantia}
                icon={ShieldCheck}
                variant="orange"
              />
            )}
            {visibility.facturas && data.facturasPendientesMonto !== null && (
              <KPICard
                title="Facturas pendientes"
                value={formatMonto(data.facturasPendientesMonto)}
                icon={FileText}
                variant="orange"
              />
            )}
            {visibility.clientes && data.clientesActivos !== null && (
              <KPICard
                title="Clientes activos"
                value={data.clientesActivos}
                icon={Users}
                variant="orange"
              />
            )}
          </div>
        )}

        {visibility.servicio && data.otsPorMes && data.cumplimientoSLA !== null && (
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
                  { estado: 'Abiertas', key: 'ABIERTA', color: '#1D4ED8' },
                  { estado: 'En proceso', key: 'EN_PROCESO', color: '#E8650A' },
                  { estado: 'Vencidas', key: 'VENCIDA', color: '#C2261B' },
                  { estado: 'Cerradas (mes)', key: 'CERRADA', color: '#15803D' },
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
        )}

        {visibility.servicio && data.ultimasOTs && (
          <Card padding={false} className="flex-1 overflow-hidden">
            <CardHeader>
              <CardTitle>Últimas órdenes de trabajo</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <RecentOTsTable ots={data.ultimasOTs} />
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
