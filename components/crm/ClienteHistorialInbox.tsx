'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, Wrench, Loader2 } from 'lucide-react'
import { formatFecha } from '@/lib/utils'
import { formatMontoMoneda } from '@/lib/moneda'
import { HistorialProductoDetalleModal } from '@/components/crm/HistorialProductoDetalleModal'
import { HistorialOTDetalleModal } from '@/components/crm/HistorialOTDetalleModal'
import { mensajeErrorJson } from '@/lib/errores'

interface ServicioRow {
  id: string
  numero: string
  descripcion: string
  tipo: string
  estado: string
  equipo: string | null
  fecha: string
}

interface ProductoRow {
  itemFacturaId: string
  descripcion: string
  cantidad: number
  subtotal: number
  moneda: string
  facturaId: string
  facturaNumero: string
  fecha: string
  inventarioId: string | null
  equipoId: string | null
}

const ESTADO_OT_LABEL: Record<string, string> = {
  ABIERTA: 'Abierta',
  EN_PROCESO: 'En proceso',
  CERRADA: 'Cerrada',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
}

const TIPO_OT_LABEL: Record<string, string> = {
  CORRECTIVO: 'Correctivo',
  PREVENTIVO: 'Preventivo',
  INSTALACION: 'Instalación',
  CALIBRACION: 'Calibración',
  GARANTIA: 'Garantía',
}

export function ClienteHistorialInbox({ clienteId }: { clienteId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [servicios, setServicios] = useState<ServicioRow[]>([])
  const [productos, setProductos] = useState<ProductoRow[]>([])
  const [detalleItemId, setDetalleItemId] = useState<string | null>(null)
  const [detalleOtId, setDetalleOtId] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setError(null)
    fetch(`/api/clientes/${clienteId}/historial`, { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(mensajeErrorJson(data, 'No se pudo cargar el historial'))
        return data
      })
      .then((data) => {
        if (cancel) return
        setServicios(data.servicios ?? [])
        setProductos(data.productos ?? [])
      })
      .catch((e: unknown) => {
        if (!cancel) {
          setServicios([])
          setProductos([])
          setError(e instanceof Error ? e.message : 'No se pudo cargar el historial')
        }
      })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [clienteId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[#9aa1ab] py-2">
        <Loader2 size={14} className="animate-spin" /> Cargando historial…
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-[12px] text-[#dc3545] leading-relaxed">
        {error}
      </p>
    )
  }

  if (servicios.length === 0 && productos.length === 0) {
    return (
      <p className="text-[12px] text-[#9aa1ab] leading-relaxed">
        Sin productos facturados ni órdenes de servicio registradas para este cliente.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {servicios.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2 flex items-center gap-1">
            <Wrench size={11} /> Servicio técnico
          </p>
          <ul className="space-y-2">
            {servicios.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setDetalleOtId(s.id)}
                  className="w-full text-left border border-[#f0f1f4] rounded-[8px] px-2.5 py-2 bg-[#fafbfc] hover:border-[#E8650A]/40 hover:bg-[#FFFBF5] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[12px] font-bold text-[#E8650A] shrink-0">
                      OT {s.numero}
                    </span>
                    <span className="text-[10px] text-[#9aa1ab] whitespace-nowrap">{formatFecha(s.fecha)}</span>
                  </div>
                  <p className="text-[11.5px] text-[#3a4150] mt-0.5 line-clamp-2">{s.descripcion}</p>
                  <p className="text-[10px] text-[#9aa1ab] mt-1">
                    {TIPO_OT_LABEL[s.tipo] ?? s.tipo}
                    {s.equipo ? ` · ${s.equipo}` : ''}
                    {' · '}
                    <span className="font-semibold">{ESTADO_OT_LABEL[s.estado] ?? s.estado}</span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {productos.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2 flex items-center gap-1">
            <Package size={11} /> Productos vendidos
          </p>
          <ul className="space-y-2">
            {productos.map((p) => (
              <li key={p.itemFacturaId}>
                <button
                  type="button"
                  onClick={() => setDetalleItemId(p.itemFacturaId)}
                  className="w-full text-left border border-[#f0f1f4] rounded-[8px] px-2.5 py-2 bg-white hover:border-[#E8650A]/40 hover:bg-[#FFFBF5] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11.5px] font-semibold text-[#1f242c] line-clamp-2 flex-1 min-w-0">{p.descripcion}</p>
                    <span className="text-[10.5px] font-bold text-[#198754] whitespace-nowrap">
                      {formatMontoMoneda(p.subtotal, p.moneda)}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9aa1ab] mt-1">
                    {p.cantidad} u · Fact. {p.facturaNumero} · {formatFecha(p.fecha)}
                    {p.equipoId && <span className="text-[#E8650A] font-semibold ml-1">· Equipo</span>}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href={`/crm/${clienteId}`}
        className="inline-block text-[11px] font-bold text-[#E8650A] hover:underline"
      >
        Ver ficha completa del cliente →
      </Link>

      <HistorialProductoDetalleModal
        itemFacturaId={detalleItemId}
        onClose={() => setDetalleItemId(null)}
      />

      <HistorialOTDetalleModal
        otId={detalleOtId}
        onClose={() => setDetalleOtId(null)}
      />
    </div>
  )
}
