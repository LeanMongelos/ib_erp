'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { formatFecha, formatMonto } from '@/lib/utils'

interface VencimientoRow {
  id: string
  numeroCuota: number
  diasDesdeEmision: number
  fechaVencimiento: string
  monto: number
  estado: string
  factura: {
    numero: string
    condicionPago?: string | null
    cliente?: { nombre: string }
  }
}

export function VencimientosProximos() {
  const [items, setItems] = useState<VencimientoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cobranzas/vencimientos?dias=120')
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  function estadoLabel(v: VencimientoRow) {
    const due = new Date(v.fechaVencimiento)
    due.setHours(0, 0, 0, 0)
    if (v.estado === 'COBRADO') return { text: 'Cobrado', className: 'text-green-700 bg-green-50' }
    if (due.getTime() <= hoy.getTime()) return { text: 'Vence hoy', className: 'text-red-700 bg-red-50' }
    return { text: `Día ${v.diasDesdeEmision}`, className: 'text-amber-700 bg-amber-50' }
  }

  return (
    <Card padding={false} className="max-w-3xl">
      <div className="px-5 py-3 border-b border-[#eef0f2]">
        <h3 className="text-[13px] font-bold text-[#1f242c]">Cronograma de cobranzas</h3>
        <p className="text-[11px] text-[#9aa1ab] mt-0.5">
          Plazos registrados por factura. Aviso automático a Guillermo y Lucas al vencer cada cuota.
        </p>
      </div>
      {loading ? (
        <p className="p-5 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="p-5 text-[12.5px] text-[#9aa1ab]">Sin vencimientos programados</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              {['Factura', 'Cliente', 'Cuota', 'Vencimiento', 'Monto', 'Estado'].map((h, i) => (
                <th
                  key={h}
                  className={`px-5 py-2.5 text-[10px] font-bold text-[#8a909a] uppercase border-b ${i > 2 ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((v, i) => {
              const badge = estadoLabel(v)
              return (
                <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                  <td className="px-5 py-3 text-[12.5px] font-bold text-[#E8650A] border-b">{v.factura.numero}</td>
                  <td className="px-5 py-3 text-[12.5px] text-[#3a4150] border-b">{v.factura.cliente?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 text-[12.5px] text-[#6b7280] border-b">
                    {v.numeroCuota} · {v.factura.condicionPago ?? `día ${v.diasDesdeEmision}`}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-right text-[#6b7280] border-b">{formatFecha(v.fechaVencimiento)}</td>
                  <td className="px-5 py-3 text-[12.5px] font-bold text-right border-b">{formatMonto(v.monto)}</td>
                  <td className="px-5 py-3 text-right border-b">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badge.className}`}>
                      {badge.text}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Card>
  )
}
