'use client'

import { useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProveedorCombobox } from '@/components/proveedores/ProveedorCombobox'
import { formatFecha, formatMonto } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface ProveedorOption {
  id: string
  razonSocial: string
}

interface LineaLibro {
  fecha: string
  proveedorRazonSocial: string
  proveedorCuit: string | null
  tipoComprobante: string
  puntoVenta: number
  numeroComprobante: number
  neto: number
  iva: number
  total: number
  moneda: string
  numeroInterno: string
}

interface TotalesLibro {
  neto: number
  iva: number
  total: number
  cantidad: number
}

function inicioMes(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LibroComprasPanel({ proveedores }: { proveedores: ProveedorOption[] }) {
  const [desde, setDesde] = useState(inicioMes())
  const [hasta, setHasta] = useState(hoy())
  const [proveedorId, setProveedorId] = useState('')
  const [loading, setLoading] = useState(false)
  const [lineas, setLineas] = useState<LineaLibro[]>([])
  const [totales, setTotales] = useState<TotalesLibro | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ desde, hasta })
      if (proveedorId) params.set('proveedorId', proveedorId)
      const res = await fetch(`/api/compras/libro-compras?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo cargar el libro de compras'))
      setLineas(data.lineas ?? [])
      setTotales(data.totales ?? null)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo cargar el libro de compras'))
      setLineas([])
      setTotales(null)
    } finally {
      setLoading(false)
    }
  }

  function exportarCsv() {
    const params = new URLSearchParams({ desde, hasta, formato: 'csv' })
    if (proveedorId) params.set('proveedorId', proveedorId)
    window.open(`/api/compras/libro-compras?${params}`, '_blank')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <Input label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Input label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <ProveedorCombobox
          value={proveedorId}
          onChange={setProveedorId}
          initialOptions={proveedores}
          label="Proveedor (opcional)"
          placeholder="Todos…"
        />
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={cargar} loading={loading}>
            <RefreshCw size={14} /> Consultar
          </Button>
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={lineas.length === 0}>
            <Download size={14} /> CSV
          </Button>
        </div>
      </div>

      {totales && (
        <p className="text-[12.5px] text-[#6b7280]">
          {totales.cantidad} comprobante{totales.cantidad !== 1 ? 's' : ''} · Neto {formatMonto(totales.neto)} · IVA {formatMonto(totales.iva)} · Total {formatMonto(totales.total)}
        </p>
      )}

      <Card padding={false}>
        {loading ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Fecha', 'Proveedor', 'CUIT', 'Tipo', 'PV', 'Nº', 'Neto', 'IVA', 'Total', 'Interno'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={`${l.numeroInterno}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                    <td className="px-4 py-[11px] text-[12px] border-b border-[#f4f5f7]">{formatFecha(l.fecha)}</td>
                    <td className="px-4 py-[11px] text-[12px] border-b border-[#f4f5f7]">{l.proveedorRazonSocial}</td>
                    <td className="px-4 py-[11px] text-[12px] border-b border-[#f4f5f7]">{l.proveedorCuit ?? '—'}</td>
                    <td className="px-4 py-[11px] text-[11px] border-b border-[#f4f5f7] max-w-[140px] truncate" title={l.tipoComprobante}>{l.tipoComprobante}</td>
                    <td className="px-4 py-[11px] text-[12px] border-b border-[#f4f5f7]">{l.puntoVenta}</td>
                    <td className="px-4 py-[11px] text-[12px] border-b border-[#f4f5f7]">{l.numeroComprobante}</td>
                    <td className="px-4 py-[11px] text-[12px] border-b border-[#f4f5f7]">{formatMonto(l.neto)}</td>
                    <td className="px-4 py-[11px] text-[12px] border-b border-[#f4f5f7]">{formatMonto(l.iva)}</td>
                    <td className="px-4 py-[11px] text-[12.5px] font-semibold border-b border-[#f4f5f7]">{formatMonto(l.total)}</td>
                    <td className="px-4 py-[11px] text-[11px] text-[#9aa1ab] border-b border-[#f4f5f7]">{l.numeroInterno}</td>
                  </tr>
                ))}
                {lineas.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-[12.5px] text-[#9aa1ab]">
                      Sin comprobantes registrados en el período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
