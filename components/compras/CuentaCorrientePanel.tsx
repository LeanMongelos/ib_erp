'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { ProveedorCombobox } from '@/components/proveedores/ProveedorCombobox'
import { formatFecha, formatMonto } from '@/lib/utils'
import { formatMontoMoneda } from '@/lib/compras/moneda-compra'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface Proveedor {
  id: string
  razonSocial: string
}

interface AgingResumen {
  bucket: string
  label: string
  monto: number
  cantidad: number
}

interface VencimientoRow {
  id: string
  facturaNumero: string
  proveedorId: string
  proveedor: string
  moneda?: string
  fecha: string
  saldo: number
  diasVencido: number
  bucket: string
}

interface CuentaCorrienteData {
  saldoTotal: number
  saldosPorMoneda?: Record<string, number>
  agingGlobal: AgingResumen[]
  proveedores: Array<{
    proveedorId: string
    proveedor: string
    saldoPendiente: number
    vencidos: number
    porVencer: number
    vencimientos: VencimientoRow[]
  }>
}

const BUCKET_CLS: Record<string, string> = {
  '0-30': 'bg-green-50 text-green-800 border-green-200',
  '31-60': 'bg-amber-50 text-amber-800 border-amber-200',
  '61-90': 'bg-orange-50 text-orange-800 border-orange-200',
  '90+': 'bg-red-50 text-red-800 border-red-200',
}

export function CuentaCorrientePanel({ proveedores }: { proveedores: Proveedor[] }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CuentaCorrienteData | null>(null)
  const [proveedorId, setProveedorId] = useState('')
  const [bucketFiltro, setBucketFiltro] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (proveedorId) params.set('proveedorId', proveedorId)
      const res = await fetch(`/api/compras/cuenta-corriente?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(json, 'No se pudo cargar cuenta corriente'))
      setData(json)
    } catch (e) {
      console.warn(mensajeErrorDesconocido(e, 'Cuenta corriente'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [proveedorId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const aging = data?.agingGlobal ?? []
  const rows = proveedorId
    ? (data?.proveedores[0]?.vencimientos ?? [])
    : data?.proveedores.flatMap((p) => p.vencimientos) ?? []

  const rowsFiltradas = bucketFiltro
    ? rows.filter((r) => r.bucket === bucketFiltro)
    : rows

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <ProveedorCombobox
            value={proveedorId}
            onChange={setProveedorId}
            initialOptions={proveedores}
            label="Proveedor (opcional)"
          />
        </div>
        <Select
          label="Bucket aging"
          value={bucketFiltro}
          onChange={(e) => setBucketFiltro(e.target.value)}
          options={[
            { value: '', label: 'Todos' },
            { value: '0-30', label: '0–30 días' },
            { value: '31-60', label: '31–60 días' },
            { value: '61-90', label: '61–90 días' },
            { value: '90+', label: 'Más de 90 días' },
          ]}
        />
        <button
          type="button"
          onClick={cargar}
          className="text-[12px] text-[#6b7280] hover:text-[#E8650A] inline-flex items-center gap-1 pb-2"
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(data?.saldosPorMoneda ?? { ARS: data?.saldoTotal ?? 0 }).map(([moneda, saldo]) => (
          <Card key={moneda} className="p-4">
            <p className="text-[11px] font-bold text-[#8a909a] uppercase">Saldo AP ({moneda})</p>
            <p className="text-[18px] font-extrabold text-[#1f242c] mt-1">
              {formatMontoMoneda(saldo, moneda)}
            </p>
          </Card>
        ))}
        {aging.map((b) => (
          <Card key={b.bucket} className={`p-4 border ${BUCKET_CLS[b.bucket] ?? ''}`}>
            <p className="text-[11px] font-bold uppercase opacity-80">{b.label}</p>
            <p className="text-[16px] font-extrabold mt-1">{formatMonto(b.monto)}</p>
            <p className="text-[11px] opacity-70">{b.cantidad} vencimiento{b.cantidad === 1 ? '' : 's'}</p>
          </Card>
        ))}
      </div>

      {!proveedorId && (data?.proveedores.length ?? 0) > 0 && (
        <Card padding={false}>
          <div className="px-5 py-3 border-b border-[#eef0f2]">
            <h3 className="text-[13px] font-bold text-[#1f242c]">Resumen por proveedor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Proveedor', 'Saldo AP', 'Vencidos', 'Por vencer', ''].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold text-[#8a909a] uppercase border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.proveedores.map((p, i) => (
                  <tr key={p.proveedorId} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                    <td className="px-5 py-3 text-[12.5px] font-semibold border-b">{p.proveedor}</td>
                    <td className="px-5 py-3 text-[12.5px] font-bold border-b">{formatMonto(p.saldoPendiente)}</td>
                    <td className="px-5 py-3 text-[12px] text-red-600 border-b">{p.vencidos}</td>
                    <td className="px-5 py-3 text-[12px] text-green-700 border-b">{p.porVencer}</td>
                    <td className="px-5 py-3 text-[12px] border-b">
                      <Link href={`/proveedores/${p.proveedorId}`} className="text-[#E8650A] font-semibold hover:underline">
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-5 py-3 border-b border-[#eef0f2] flex justify-between items-center">
          <h3 className="text-[13px] font-bold text-[#1f242c]">Vencimientos pendientes</h3>
          <span className="text-[11px] text-[#9aa1ab]">{rowsFiltradas.length} ítem(s)</span>
        </div>
        {loading ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : rowsFiltradas.length === 0 ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">Sin saldos pendientes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Proveedor', 'Factura', 'Moneda', 'Vencimiento', 'Saldo', 'Días', 'Bucket'].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold text-[#8a909a] uppercase border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsFiltradas.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                    <td className="px-5 py-3 text-[12px] border-b">{r.proveedor}</td>
                    <td className="px-5 py-3 text-[12.5px] font-semibold border-b">{r.facturaNumero}</td>
                    <td className="px-5 py-3 text-[12px] border-b">{r.moneda ?? 'ARS'}</td>
                    <td className="px-5 py-3 text-[12px] border-b">{formatFecha(r.fecha)}</td>
                    <td className="px-5 py-3 text-[12.5px] font-bold border-b">{formatMontoMoneda(r.saldo, r.moneda ?? 'ARS')}</td>
                    <td className={`px-5 py-3 text-[12px] border-b ${r.diasVencido > 0 ? 'text-red-600 font-semibold' : 'text-green-700'}`}>
                      {r.diasVencido > 0 ? `+${r.diasVencido}` : r.diasVencido}
                    </td>
                    <td className="px-5 py-3 text-[11px] border-b">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${BUCKET_CLS[r.bucket] ?? 'bg-gray-100'}`}>
                        {r.bucket}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {proveedorId && (
        <p className="text-[12px]">
          <Link href={`/proveedores/${proveedorId}`} className="text-[#E8650A] font-semibold hover:underline">
            Ver ficha del proveedor (historial AP) →
          </Link>
        </p>
      )}
    </div>
  )
}
