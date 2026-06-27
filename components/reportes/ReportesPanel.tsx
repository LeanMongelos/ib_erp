'use client'

import { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, Wallet, Wrench, FileSpreadsheet, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { KPICard } from '@/components/dashboard/KPICard'
import { ReportesCsvCentro } from '@/components/reportes/ReportesCsvCentro'
import { formatMonto } from '@/lib/utils'
import { LABEL_SEGMENTO, type SegmentoCliente } from '@/lib/clientes-metrics'

type Resumen = {
  comercial: {
    facturasPorMes: { mes: string; monto: number; cantidad: number }[]
    presupuestosPorEstado: { estado: string; cantidad: number }[]
    topClientes: { clienteId: string; nombre: string; total: number }[]
    segmentos: Record<string, number>
  } | null
  financiero: {
    facturasPorEstado: { estado: string; cantidad: number; monto: number }[]
    deudaTotal: number
  } | null
  operativo: {
    otsPorEstado: { estado: string; cantidad: number }[]
    productosBajoMinimo: { id: string; nombre: string; stock: number; stockMinimo: number }[]
    conversacionesAbiertas: number
  } | null
  fiscal: {
    periodo: string
    mesActual: { cantidad: number; neto: number; iva: number; total: number }
    porTipo: { tipo: string; cantidad: number; neto: number; iva: number; total: number }[]
    porEmisor: { emisorId: string | null; razonSocial: string; cuit: string; cantidad: number; neto: number; iva: number; total: number }[]
    ivaPorMes: { mes: string; iva: number; neto: number; total: number; cantidad: number }[]
    alertas: { pendientesCae: number; rechazadas: number; anuladas: number; conCae: number }
  } | null
}

const TABS = [
  { id: 'comercial', label: 'Comercial', icon: TrendingUp },
  { id: 'financiero', label: 'Financiero', icon: Wallet },
  { id: 'fiscal', label: 'Fiscal AFIP', icon: FileSpreadsheet },
  { id: 'operativo', label: 'Operativo', icon: Wrench },
] as const

type TabId = typeof TABS[number]['id']

export function ReportesPanel() {
  const [data, setData] = useState<Resumen | null>(null)
  const [tab, setTab] = useState<TabId>('comercial')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reportes/resumen')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        if (!d.comercial && d.financiero) setTab('financiero')
        else if (!d.comercial && !d.financiero && d.operativo) setTab('operativo')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-[13px] text-[#7c828c] p-6">Cargando reportes…</p>
  }

  if (!data) return null

  const tabsVisibles = TABS.filter((t) => data[t.id as keyof Resumen])

  async function exportarFiscal() {
    window.open('/api/reportes/fiscal/export', '_blank')
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 flex-wrap">
        {tabsVisibles.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as TabId)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-[9px] text-[13px] font-semibold transition-colors ${
              tab === id
                ? 'bg-[#E8650A] text-white'
                : 'bg-white border border-[#edeef1] text-[#7c828c] hover:text-[#16181d]'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'comercial' && data.comercial && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard
              title="Facturación último mes"
              value={formatMonto(data.comercial.facturasPorMes.at(-1)?.monto ?? 0)}
              icon={BarChart3}
              variant="orange"
            />
            <KPICard
              title="Clientes top (5)"
              value={data.comercial.topClientes.length}
              icon={TrendingUp}
              variant="blue"
            />
          </div>

          <Card>
            <CardHeader><CardTitle>Facturación — últimos 6 meses</CardTitle></CardHeader>
            <div className="px-5 pb-5 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[#7c828c] border-b border-[#edeef1]">
                    <th className="py-2 font-semibold">Mes</th>
                    <th className="py-2 font-semibold">Facturas</th>
                    <th className="py-2 font-semibold text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comercial.facturasPorMes.map((f) => (
                    <tr key={f.mes} className="border-b border-[#f4f5f7]">
                      <td className="py-2.5 capitalize">{f.mes}</td>
                      <td className="py-2.5">{f.cantidad}</td>
                      <td className="py-2.5 text-right font-semibold">{formatMonto(f.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Top clientes por facturación</CardTitle></CardHeader>
              <ul className="px-5 pb-5 space-y-2">
                {data.comercial.topClientes.map((c, i) => (
                  <li key={c.clienteId} className="flex justify-between text-[13px]">
                    <span>{i + 1}. {c.nombre}</span>
                    <span className="font-semibold">{formatMonto(c.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader><CardTitle>Segmentación automática (RFM)</CardTitle></CardHeader>
              <ul className="px-5 pb-5 space-y-2">
                {Object.entries(data.comercial.segmentos).map(([seg, n]) => (
                  <li key={seg} className="flex justify-between text-[13px]">
                    <span>{LABEL_SEGMENTO[seg as SegmentoCliente] ?? seg}</span>
                    <span className="font-semibold">{n} clientes</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === 'financiero' && data.financiero && (
        <div className="flex flex-col gap-5">
          <KPICard
            title="Deuda total activa"
            value={formatMonto(data.financiero.deudaTotal)}
            icon={Wallet}
            variant="red"
          />
          <Card>
            <CardHeader><CardTitle>Facturas por estado</CardTitle></CardHeader>
            <div className="px-5 pb-5 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[#7c828c] border-b border-[#edeef1]">
                    <th className="py-2 font-semibold">Estado</th>
                    <th className="py-2 font-semibold">Cantidad</th>
                    <th className="py-2 font-semibold text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.financiero.facturasPorEstado.map((f) => (
                    <tr key={f.estado} className="border-b border-[#f4f5f7]">
                      <td className="py-2.5">{f.estado}</td>
                      <td className="py-2.5">{f.cantidad}</td>
                      <td className="py-2.5 text-right font-semibold">{formatMonto(f.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'fiscal' && data.fiscal && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#7c828c] capitalize">Período: {data.fiscal.periodo}</p>
            <Button variant="outline" size="sm" onClick={exportarFiscal}>
              <Download size={14} className="mr-1.5" />
              Exportar CSV
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Neto del mes" value={formatMonto(data.fiscal.mesActual.neto)} icon={FileSpreadsheet} variant="orange" />
            <KPICard title="IVA del mes" value={formatMonto(data.fiscal.mesActual.iva)} icon={Wallet} variant="blue" />
            <KPICard title="Total facturado" value={formatMonto(data.fiscal.mesActual.total)} icon={TrendingUp} variant="green" />
            <KPICard title="Pendientes CAE" value={data.fiscal.alertas.pendientesCae} icon={BarChart3} variant="red" />
          </div>
          <Card>
            <CardHeader><CardTitle>IVA débito — últimos 6 meses</CardTitle></CardHeader>
            <div className="px-5 pb-5 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[#7c828c] border-b border-[#edeef1]">
                    <th className="py-2">Mes</th>
                    <th className="py-2 text-right">Neto</th>
                    <th className="py-2 text-right">IVA</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fiscal.ivaPorMes.map((m) => (
                    <tr key={m.mes} className="border-b border-[#f4f5f7]">
                      <td className="py-2.5 capitalize">{m.mes}</td>
                      <td className="py-2.5 text-right">{formatMonto(m.neto)}</td>
                      <td className="py-2.5 text-right font-semibold">{formatMonto(m.iva)}</td>
                      <td className="py-2.5 text-right">{formatMonto(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Por tipo de comprobante</CardTitle></CardHeader>
              <ul className="px-5 pb-5 space-y-2">
                {data.fiscal.porTipo.map((t) => (
                  <li key={t.tipo} className="flex justify-between text-[13px]">
                    <span>Factura {t.tipo}</span>
                    <span className="font-semibold">{formatMonto(t.total)} ({t.cantidad})</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader><CardTitle>Por emisor (CUIT)</CardTitle></CardHeader>
              <ul className="px-5 pb-5 space-y-2">
                {data.fiscal.porEmisor.map((e) => (
                  <li key={e.emisorId ?? e.cuit} className="text-[13px]">
                    <div className="flex justify-between">
                      <span>{e.razonSocial}</span>
                      <span className="font-semibold">{formatMonto(e.total)}</span>
                    </div>
                    <p className="text-[11px] text-[#9aa1ab]">CUIT {e.cuit}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === 'operativo' && data.operativo && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KPICard
              title="Conversaciones CRM abiertas"
              value={data.operativo.conversacionesAbiertas}
              icon={BarChart3}
              variant="blue"
            />
            <KPICard
              title="Ítems bajo stock mínimo"
              value={data.operativo.productosBajoMinimo.length}
              icon={Wrench}
              variant="red"
            />
          </div>
          <Card>
            <CardHeader><CardTitle>OTs por estado</CardTitle></CardHeader>
            <ul className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.operativo.otsPorEstado.map((o) => (
                <li key={o.estado} className="bg-[#F4F6F9] rounded-[9px] p-3 text-center">
                  <p className="text-[22px] font-extrabold text-[#16181d]">{o.cantidad}</p>
                  <p className="text-[11px] text-[#7c828c] font-semibold">{o.estado}</p>
                </li>
              ))}
            </ul>
          </Card>
          {data.operativo.productosBajoMinimo.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Inventario bajo mínimo</CardTitle></CardHeader>
              <ul className="px-5 pb-5 space-y-2">
                {data.operativo.productosBajoMinimo.map((p) => (
                  <li key={p.id} className="flex justify-between text-[13px]">
                    <span>{p.nombre}</span>
                    <span className="text-red-600 font-semibold">{p.stock} / mín {p.stockMinimo}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <ReportesCsvCentro />
    </div>
  )
}
