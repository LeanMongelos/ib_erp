'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Download, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { MODOS_TRAZABILIDAD } from '@/lib/inventario-constants'

export interface FilaStockDeposito {
  inventarioId: string
  productoNombre: string
  sku: string | null
  modoTrazabilidad: string
  depositoId: string | null
  depositoNombre: string
  cantidad: number
  ubicacionDetalle: string | null
  unidadId?: string
  numeroSerie?: string | null
  lote?: string | null
}

interface DepositoOption {
  id: string
  nombre: string
}

interface Props {
  depositos: DepositoOption[]
}

export function StockPorDepositoPanel({ depositos }: Props) {
  const [filtroDeposito, setFiltroDeposito] = useState('')
  const [filas, setFilas] = useState<FilaStockDeposito[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = filtroDeposito ? `?depositoId=${encodeURIComponent(filtroDeposito)}` : ''
      const res = await fetch(`/api/inventario/stock-por-deposito${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo cargar el stock'))
      const data = await res.json()
      setFilas(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar stock por depósito'))
    } finally {
      setLoading(false)
    }
  }, [filtroDeposito])

  useEffect(() => {
    cargar()
  }, [cargar])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return filas
    return filas.filter(
      (f) =>
        f.productoNombre.toLowerCase().includes(q) ||
        (f.sku?.toLowerCase().includes(q) ?? false) ||
        (f.numeroSerie?.toLowerCase().includes(q) ?? false) ||
        f.depositoNombre.toLowerCase().includes(q),
    )
  }, [filas, busqueda])

  const resumen = useMemo(() => {
    const porDeposito = new Map<string, number>()
    for (const f of filas) {
      porDeposito.set(f.depositoNombre, (porDeposito.get(f.depositoNombre) ?? 0) + f.cantidad)
    }
    return porDeposito
  }, [filas])

  async function exportarCsv() {
    try {
      const params = new URLSearchParams({ formato: 'csv' })
      if (filtroDeposito) params.set('depositoId', filtroDeposito)
      const res = await fetch(`/api/inventario/stock-por-deposito?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo exportar'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'stock-por-deposito.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo exportar CSV'))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-[#FFFBF5] border-[#FFE4CC]">
        <p className="text-[12.5px] text-[#7c4a1a] leading-relaxed">
          Stock desglosado por depósito y ubicación. Productos serializados muestran cada unidad con SN/lote.
        </p>
      </Card>

      {resumen.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(resumen.entries()).map(([nombre, cant]) => (
            <span
              key={nombre}
              className="inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[#e4e7eb] text-[#3a4150]"
            >
              {nombre}: {cant}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2 items-end">
          <Select
            label="Depósito"
            value={filtroDeposito}
            onChange={(e) => setFiltroDeposito(e.target.value)}
            placeholder="Todos los depósitos"
            options={[
              { value: '', label: 'Todos' },
              ...depositos.map((d) => ({ value: d.id, label: d.nombre })),
            ]}
          />
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Buscar</label>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Producto, código, SN…"
              className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px]"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => cargar()} loading={loading}>
            <RefreshCw size={14} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportarCsv}>
            <Download size={14} /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Depósito', 'Producto', 'Código', 'Cant.', 'Ubicación', 'N° serie', 'Lote', 'Trazab.'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[12.5px] text-[#9aa1ab]">
                    Cargando…
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[12.5px] text-[#9aa1ab]">
                    Sin stock en el filtro seleccionado
                  </td>
                </tr>
              ) : (
                filtradas.map((f, i) => (
                  <tr key={f.unidadId ?? `${f.inventarioId}-${f.depositoId}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                    <td className="px-4 py-[11px] text-[12px] font-semibold border-b border-[#f4f5f7]">{f.depositoNombre}</td>
                    <td className="px-4 py-[11px] text-[12.5px] border-b border-[#f4f5f7]">{f.productoNombre}</td>
                    <td className="px-4 py-[11px] text-[12px] font-mono text-[#6b7280] border-b border-[#f4f5f7]">{f.sku ?? '—'}</td>
                    <td className="px-4 py-[11px] text-[12.5px] font-bold border-b border-[#f4f5f7]">{f.cantidad}</td>
                    <td className="px-4 py-[11px] text-[12px] text-[#6b7280] border-b border-[#f4f5f7]">{f.ubicacionDetalle ?? '—'}</td>
                    <td className="px-4 py-[11px] text-[12px] font-mono border-b border-[#f4f5f7]">{f.numeroSerie ?? '—'}</td>
                    <td className="px-4 py-[11px] text-[12px] border-b border-[#f4f5f7]">{f.lote ?? '—'}</td>
                    <td className="px-4 py-[11px] text-[11px] text-[#9aa1ab] border-b border-[#f4f5f7]">
                      {MODOS_TRAZABILIDAD.find((m) => m.value === f.modoTrazabilidad)?.label ?? f.modoTrazabilidad}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
