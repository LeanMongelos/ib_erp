'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { MEDIO_PAGO } from '@/lib/form-options'
import { formatFecha, formatMonto } from '@/lib/utils'
import { mensajeErrorRespuesta } from '@/lib/errores'

interface Cliente {
  id: string
  nombre: string
}

interface PagoRow {
  id: string
  monto: number
  medio: string
  fecha: string
  referencia: string | null
  cliente: { id: string; nombre: string }
  imputaciones: Array<{ monto: number; factura: { numero: string } }>
  registradoPor: { id: string; nombre: string } | null
}

const MEDIO_LABEL = Object.fromEntries(MEDIO_PAGO.map((m) => [m.value, m.label]))

export function PagosRegistradosList({ clientes }: { clientes: Cliente[] }) {
  const [pagos, setPagos] = useState<PagoRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [clienteId, setClienteId] = useState('')
  const [referencia, setReferencia] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const cargar = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' })
      if (clienteId) params.set('clienteId', clienteId)
      if (referencia.trim()) params.set('referencia', referencia.trim())
      if (fechaDesde) params.set('fechaDesde', fechaDesde)
      if (fechaHasta) params.set('fechaHasta', fechaHasta)
      const res = await fetch(`/api/cobranzas/pagos?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron cargar los pagos'))
      const data = await res.json()
      setPagos(data.pagos ?? [])
      setTotal(data.total ?? 0)
      setPage(data.page ?? 1)
      setPages(data.pages ?? 1)
    } catch (e) {
      console.error(e)
      setPagos([])
    } finally {
      setLoading(false)
    }
  }, [page, clienteId, referencia, fechaDesde, fechaHasta])

  useEffect(() => {
    cargar(1)
  }, [clienteId, referencia, fechaDesde, fechaHasta]) // eslint-disable-line react-hooks/exhaustive-deps

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    cargar(1)
  }

  function facturasLabel(p: PagoRow) {
    if (p.imputaciones.length === 0) return '—'
    return p.imputaciones.map((i) => i.factura.numero).join(', ')
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={buscar} className="flex flex-wrap gap-3 items-end">
          <Select
            label="Cliente"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            options={[{ value: '', label: 'Todos' }, ...clientes.map((c) => ({ value: c.id, label: c.nombre }))]}
            className="min-w-[200px]"
          />
          <div className="flex items-center gap-2 bg-[#f4f6f9] border border-[#e4e7eb] rounded-[9px] px-3 py-2 flex-1 min-w-[180px]">
            <Search size={16} className="text-[#9aa1ab]" />
            <input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Referencia (transferencia, cheque…)"
              className="flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
          <Input
            label="Desde"
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="min-w-[140px]"
          />
          <Input
            label="Hasta"
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="min-w-[140px]"
          />
          <Button type="submit" variant="primary" size="sm">Filtrar</Button>
        </form>
      </Card>

      <Card padding={false}>
        <div className="px-5 py-3 border-b border-[#eef0f2] flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-bold text-[#1f242c]">Pagos registrados</h3>
            <p className="text-[11px] text-[#9aa1ab] mt-0.5">
              {total.toLocaleString('es-AR')} pago{total === 1 ? '' : 's'} en total
            </p>
          </div>
        </div>
        {loading ? (
          <p className="p-5 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : pagos.length === 0 ? (
          <p className="p-5 text-[12.5px] text-[#9aa1ab]">Sin pagos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Fecha', 'Cliente', 'Monto', 'Medio', 'Referencia', 'Facturas imputadas', 'Registrado por'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-2.5 text-[10px] font-bold text-[#8a909a] uppercase border-b whitespace-nowrap ${
                        i === 2 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagos.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                    <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b whitespace-nowrap">
                      {formatFecha(p.fecha)}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] font-semibold text-[#3a4150] border-b">
                      {p.cliente.nombre}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] font-bold text-right text-green-700 border-b whitespace-nowrap">
                      {formatMonto(p.monto)}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b whitespace-nowrap">
                      {MEDIO_LABEL[p.medio] ?? p.medio}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b max-w-[180px] truncate" title={p.referencia ?? undefined}>
                      {p.referencia ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] text-[#E8650A] font-semibold border-b">
                      {facturasLabel(p)}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b whitespace-nowrap">
                      {p.registradoPor?.nombre ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="px-5 py-3 border-t border-[#eef0f2] flex items-center justify-between">
            <span className="text-[12px] text-[#9aa1ab]">
              Página {page} de {pages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => cargar(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages || loading}
                onClick={() => cargar(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
