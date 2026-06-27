'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatFecha } from '@/lib/utils'
import { labelEventoOc, type PasoOcTimeline, type EventoOcTimeline } from '@/lib/compras/oc-workflow/timeline-types'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

const PASO_CLS: Record<PasoOcTimeline['estado'], string> = {
  pendiente: 'bg-[#f3f4f6] text-[#9aa1ab] border-[#e5e7eb]',
  activo: 'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]',
  completo: 'bg-[#ECFDF5] text-[#047857] border-[#6EE7B7]',
  rechazado: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
  omitido: 'bg-[#f9fafb] text-[#d1d5db] border-dashed border-[#e5e7eb]',
}

export function TimelineOrdenCompra({ ocId }: { ocId: string }) {
  const [loading, setLoading] = useState(true)
  const [cumplimiento, setCumplimiento] = useState(0)
  const [pasos, setPasos] = useState<PasoOcTimeline[]>([])
  const [eventos, setEventos] = useState<EventoOcTimeline[]>([])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ordenes-compra/${ocId}/timeline`)
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo cargar el seguimiento'))
      setCumplimiento(data.cumplimientoPct ?? 0)
      setPasos(data.pasos ?? [])
      setEventos(data.eventos ?? [])
    } catch (e) {
      console.warn(mensajeErrorDesconocido(e, 'Timeline OC'))
    } finally {
      setLoading(false)
    }
  }, [ocId])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (loading) {
    return <p className="text-[12px] text-[#9aa1ab] py-4">Cargando seguimiento…</p>
  }

  return (
    <div className="flex flex-col gap-4 border-t border-[#f0f1f4] pt-4 mt-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[12px] font-bold text-[#8a909a] uppercase tracking-wide">Seguimiento de la solicitud</h4>
        <span className="text-[12px] font-bold text-[#E8650A]">{cumplimiento}% cumplimiento</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {pasos.map((p) => (
          <div
            key={p.id}
            className={`rounded-lg border px-3 py-2 min-w-[120px] flex-1 ${PASO_CLS[p.estado]}`}
            title={p.detalle}
          >
            <p className="text-[11px] font-bold">{p.label}</p>
            {p.detalle && <p className="text-[10px] mt-0.5 opacity-90 line-clamp-2">{p.detalle}</p>}
          </div>
        ))}
      </div>

      <div className="relative pl-4 border-l-2 border-[#e5e7eb] space-y-3 max-h-48 overflow-y-auto">
        {eventos.length === 0 && (
          <p className="text-[12px] text-[#9aa1ab]">Sin eventos registrados aún.</p>
        )}
        {eventos.map((ev) => (
          <div key={ev.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#E8650A] ring-2 ring-white" />
            <p className="text-[12px] font-semibold text-[#1f242c]">{labelEventoOc(ev.tipo)}</p>
            <p className="text-[11px] text-[#6b7280]">
              {formatFecha(ev.fecha)}
              {ev.usuario?.nombre ? ` · ${ev.usuario.nombre}` : ''}
              {ev.referencia ? ` · ${ev.referencia}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
