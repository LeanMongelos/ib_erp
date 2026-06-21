'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Plus, FileText, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeEstadoFactura } from '@/components/ui/badge'
import { formatFecha } from '@/lib/utils'
import { formatMontoMoneda } from '@/lib/moneda'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

const ESTADOS_FACTURA = [
  { value: 'TODOS',    label: 'Todos los estados' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'PENDIENTE',label: 'Pendiente' },
  { value: 'PENDIENTE_CAE', label: 'Pend. CAE' },
  { value: 'EMITIDA',  label: 'Emitida AFIP' },
  { value: 'RECHAZADA',label: 'Rechazada' },
  { value: 'PAGADA',   label: 'Pagada' },
  { value: 'VENCIDA',  label: 'Vencida' },
  { value: 'ANULADA',  label: 'Anulada' },
]

interface VencimientoRow {
  numeroCuota: number
  diasDesdeEmision: number
  fechaVencimiento: string
  monto: number
  estado: string
}

interface FacturaRow {
  id: string
  numero: string
  tipo: string
  estado: string
  fechaEmision: string
  fechaVencimiento?: string | null
  condicionPago?: string | null
  subtotal: number
  iva: number
  total: number
  moneda?: string
  cae?: string | null
  cliente?: { nombre: string }
  vencimientos?: VencimientoRow[]
}

function proximoVencimiento(vencimientos?: VencimientoRow[]) {
  if (!vencimientos?.length) return null
  const pendiente = vencimientos.find((v) => v.estado === 'PENDIENTE' || v.estado === 'AVISO_ENVIADO')
  return pendiente ?? null
}

export function FacturasTable({ facturas }: { facturas: FacturaRow[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('TODOS')
  const [emitiendo, setEmitiendo] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    const id = searchParams.get('highlight')
    if (!id) return
    const f = facturas.find((x) => x.id === id)
    if (f) {
      setSearch(f.numero)
      setHighlightId(id)
    }
  }, [searchParams, facturas])

  const filtered = facturas.filter((f) => {
    const q = search.toLowerCase()
    const matchSearch =
      !search ||
      f.numero.toLowerCase().includes(q) ||
      (f.cliente?.nombre ?? '').toLowerCase().includes(q) ||
      (f.cae ?? '').includes(q)
    const matchEstado = estado === 'TODOS' || f.estado === estado
    return matchSearch && matchEstado
  })

  async function emitirAfip(id: string) {
    setEmitiendo(id)
    try {
      const res = await fetch(`/api/facturas/${id}/emitir`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo emitir el comprobante en AFIP'))
      toast.success(data.simulado ? 'CAE simulado (sin certificado)' : 'Factura emitida en AFIP')
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo emitir el comprobante en AFIP'))
    } finally {
      setEmitiendo(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 w-[280px]">
          <Search size={16} className="text-[#9aa1ab]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar factura, cliente, CAE…"
            className="flex-1 text-[12.5px] bg-transparent border-none outline-none text-[#1f242c] placeholder:text-[#9aa1ab]"
          />
        </div>

        <div className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2">
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="text-[12.5px] text-[#3a4150] font-semibold bg-transparent border-none outline-none cursor-pointer"
          >
            {ESTADOS_FACTURA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>

        <div className="flex-1" />

        <Button onClick={() => router.push('/facturacion/nueva')}>
          <Plus size={16} strokeWidth={2.4} />
          Nueva Factura
        </Button>
      </div>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['N° Factura', 'Cliente', 'Tipo', 'Fecha', 'Plazos', 'Total', 'CAE', 'Estado', 'Acciones'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => {
                const prox = proximoVencimiento(f.vencimientos)
                return (
                <tr key={f.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'} ${f.id === highlightId ? 'ring-2 ring-inset ring-[#E8650A]' : ''}`}>
                  <td className="px-5 py-[13px] text-[12.5px] font-bold text-[#E8650A] border-b border-[#f4f5f7]">{f.numero}</td>
                  <td className="px-5 py-[13px] text-[12.5px] font-semibold text-[#3a4150] border-b border-[#f4f5f7]">{f.cliente?.nombre ?? '—'}</td>
                  <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">Tipo {f.tipo}</span>
                  </td>
                  <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{formatFecha(f.fechaEmision)}</td>
                  <td className="px-5 py-[13px] text-[12px] text-[#6b7280] border-b border-[#f4f5f7]">
                    <div>{f.condicionPago ?? '—'}</div>
                    {prox && (
                      <div className="text-[10.5px] text-[#E8650A] font-semibold mt-0.5">
                        Próx: día {prox.diasDesdeEmision} ({formatFecha(prox.fechaVencimiento)})
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-[13px] text-[12.5px] font-bold text-[#1f242c] border-b border-[#f4f5f7]">{formatMontoMoneda(f.total, f.moneda ?? 'ARS')}</td>
                  <td className="px-5 py-[13px] text-[11px] text-[#6b7280] font-mono border-b border-[#f4f5f7]">{f.cae ? f.cae.slice(0, 12) + '…' : '—'}</td>
                  <td className="px-5 py-[13px] border-b border-[#f4f5f7]"><BadgeEstadoFactura estado={f.estado as any} /></td>
                  <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => window.open(`/api/facturas/${f.id}/pdf`, '_blank')}
                        className="p-1.5 text-[#6b7280] hover:text-[#E8650A] rounded"
                        title="Ver PDF"
                      >
                        <FileText size={15} />
                      </button>
                      {['BORRADOR', 'PENDIENTE', 'RECHAZADA'].includes(f.estado) && (
                        <button
                          onClick={() => emitirAfip(f.id)}
                          disabled={emitiendo === f.id}
                          className="p-1.5 text-[#6b7280] hover:text-[#E8650A] rounded disabled:opacity-50"
                          title="Emitir AFIP"
                        >
                          <Zap size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">No se encontraron facturas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
