'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatFecha } from '@/lib/utils'
import { formatMontoMoneda } from '@/lib/compras/moneda-compra'
import { labelEventoAp, type EventoHistorialAp, type KpisHistorialAp, type TipoEventoAp } from '@/lib/compras/historial-ap-types'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

const TIPO_CLS: Record<TipoEventoAp, string> = {
  OC_CREADA: 'bg-gray-100 text-gray-700',
  OC_APROBADA: 'bg-blue-100 text-blue-800',
  OC_RECEPCION: 'bg-indigo-100 text-indigo-800',
  FC_REGISTRADA: 'bg-red-100 text-red-800',
  VENCIMIENTO_CREADO: 'bg-amber-100 text-amber-800',
  PAGO: 'bg-green-100 text-green-800',
  FC_ANULADA: 'bg-gray-200 text-gray-600 line-through',
}

export function HistorialApTimeline({
  proveedorId,
  proveedorNombre,
}: {
  proveedorId: string
  proveedorNombre?: string
}) {
  const [loading, setLoading] = useState(true)
  const [eventos, setEventos] = useState<EventoHistorialAp[]>([])
  const [kpis, setKpis] = useState<KpisHistorialAp[]>([])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proveedores/${proveedorId}/historial-ap`)
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo cargar el historial'))
      setEventos(data.eventos ?? [])
      setKpis(data.kpis ?? [])
    } catch (e) {
      console.warn(mensajeErrorDesconocido(e, 'Historial AP'))
      setEventos([])
      setKpis([])
    } finally {
      setLoading(false)
    }
  }, [proveedorId])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-[#6b7280]">
          Timeline de deuda AP{proveedorNombre ? ` · ${proveedorNombre}` : ''}
        </p>
        <button
          type="button"
          onClick={cargar}
          className="text-[12px] text-[#6b7280] hover:text-[#E8650A] inline-flex items-center gap-1"
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {kpis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {kpis.map((k) => (
            <Card key={k.moneda} className="p-3">
              <p className="text-[10px] font-bold text-[#8a909a] uppercase">{k.moneda} · resumen</p>
              <div className="mt-2 space-y-1 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Deuda generada</span>
                  <span className="font-bold">{formatMontoMoneda(k.deudaGenerada, k.moneda)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Pagada</span>
                  <span className="font-bold text-green-700">{formatMontoMoneda(k.pagada, k.moneda)}</span>
                </div>
                <div className="flex justify-between border-t border-[#eef0f2] pt-1">
                  <span className="text-[#6b7280]">Pendiente hoy</span>
                  <span className="font-extrabold text-[#1f242c]">{formatMontoMoneda(k.pendienteHoy, k.moneda)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-[12.5px] text-[#9aa1ab] p-4">Cargando historial…</p>
      ) : eventos.length === 0 ? (
        <p className="text-[12.5px] text-[#9aa1ab] p-4">Sin movimientos AP registrados</p>
      ) : (
        <ol className="relative border-l border-[#e4e7eb] ml-3 space-y-4">
          {eventos.map((ev) => (
            <li key={`${ev.tipo}-${ev.id}`} className="ml-4">
              <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-[#E8650A] border-2 border-white" />
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIPO_CLS[ev.tipo]}`}>
                  {labelEventoAp(ev.tipo)}
                </span>
                <span className="text-[11px] text-[#9aa1ab]">{formatFecha(ev.fecha)}</span>
                {ev.moneda && ev.moneda !== 'ARS' && (
                  <span className="text-[10px] font-bold text-[#6b7280]">{ev.moneda}</span>
                )}
              </div>
              <Link href={ev.href} className="text-[13px] font-semibold text-[#1f242c] hover:text-[#E8650A]">
                {ev.referencia}
              </Link>
              <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-[#6b7280]">
                {ev.monto != null && (
                  <span>Monto: <strong>{formatMontoMoneda(ev.monto, ev.moneda ?? 'ARS')}</strong></span>
                )}
                {ev.saldoAcumulado != null && (
                  <span>Saldo AP: <strong>{formatMontoMoneda(ev.saldoAcumulado, ev.moneda ?? 'ARS')}</strong></span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
