'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Loader2, Wrench, Clock, User, Cpu } from 'lucide-react'
import { formatFecha, formatFechaHora, formatMonto } from '@/lib/utils'
import { labelTipoOT } from '@/lib/inventario-constants'
import { OTTimeline } from '@/components/servicio-tecnico/OTTimeline'
import { mensajeErrorDesconocido, parsearRespuestaApi } from '@/lib/errores'

interface Props {
  otId: string | null
  onClose: () => void
}

const ESTADO_LABEL: Record<string, string> = {
  ABIERTA: 'Abierta',
  EN_PROCESO: 'En proceso',
  CERRADA: 'Cerrada',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
}

const PRIORIDAD_LABEL: Record<string, string> = {
  BAJA: 'Baja',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
}

function Fila({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-[12px] py-1 border-b border-[#f4f5f7] last:border-0">
      <span className="text-[#8a909a] font-semibold">{label}</span>
      <span className="text-[#1f242c]">{value}</span>
    </div>
  )
}

export function HistorialOTDetalleModal({ otId, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [ot, setOt] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!otId) return
    let cancel = false
    setLoading(true)
    setError(null)
    fetch(`/api/ots/${encodeURIComponent(otId)}`, { credentials: 'include' })
      .then((r) => parsearRespuestaApi<any>(r, 'No se pudo cargar la orden de trabajo'))
      .then((d) => { if (!cancel) setOt(d) })
      .catch((e) => { if (!cancel) setError(mensajeErrorDesconocido(e, 'No se pudo cargar la orden de trabajo')) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [otId])

  if (!otId) return null

  const repuestos = ot?.repuestos ?? []
  const totalRepuestos = repuestos.reduce(
    (acc: number, r: { cantidad: number; precioUnit: number }) => acc + r.cantidad * Number(r.precioUnit),
    0,
  )

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
      data-modal-overlay
    >
      <div className="bg-white rounded-[12px] w-full max-w-lg max-h-[88vh] shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#e4e7eb] shrink-0">
          <div className="min-w-0 pr-3">
            <p className="text-[10px] font-bold text-[#8a909a] uppercase tracking-wide flex items-center gap-1">
              <Wrench size={11} /> Orden de trabajo
            </p>
            <h3 className="text-[15px] font-bold text-[#1f242c] mt-0.5">
              {ot ? `OT ${ot.numero}` : 'Detalle de OT'}
            </h3>
            {ot && (
              <p className="text-[11px] text-[#9aa1ab] mt-1">
                {ESTADO_LABEL[ot.estado] ?? ot.estado}
                {' · '}
                {labelTipoOT(ot.tipo)}
                {ot.fechaApertura && ` · Apertura ${formatFecha(ot.fechaApertura)}`}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-[#9aa1ab] hover:text-[#3a4150] p-1 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-[12px] text-[#9aa1ab] py-8 justify-center">
              <Loader2 size={16} className="animate-spin" /> Cargando trabajo realizado…
            </div>
          )}
          {error && <p className="text-[12px] text-red-600">{error}</p>}

          {!loading && ot && (
            <div className="space-y-5">
              <section className="bg-[#fafbfc] rounded-[8px] px-3 py-2">
                <Fila label="Estado" value={ESTADO_LABEL[ot.estado] ?? ot.estado} />
                <Fila label="Prioridad" value={PRIORIDAD_LABEL[ot.prioridad] ?? ot.prioridad} />
                <Fila label="Tipo" value={labelTipoOT(ot.tipo)} />
                <Fila label="Apertura" value={formatFechaHora(ot.fechaApertura)} />
                <Fila label="Cierre" value={ot.fechaCierre ? formatFechaHora(ot.fechaCierre) : null} />
                <Fila label="SLA vence" value={formatFechaHora(ot.slaVence)} />
                <Fila label="Cliente" value={ot.cliente?.nombre} />
                <Fila
                  label="Técnico"
                  value={ot.tecnico?.nombre ?? 'Sin asignar'}
                />
              </section>

              {ot.equipo && (
                <section>
                  <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2 flex items-center gap-1">
                    <Cpu size={11} /> Equipo intervenido
                  </p>
                  <div className="bg-[#FFF8F2] border border-[#FFE4CC] rounded-[8px] px-3 py-2">
                    <Fila label="Nombre" value={ot.equipo.nombre} />
                    <Fila label="Marca / Modelo" value={[ot.equipo.marca, ot.equipo.modelo].filter(Boolean).join(' · ') || null} />
                    <Fila label="N° serie" value={ot.equipo.numeroSerie} />
                    <Link
                      href={`/servicio-tecnico/equipos/${ot.equipo.id}`}
                      className="inline-block mt-2 text-[11px] font-bold text-[#E8650A] hover:underline"
                    >
                      Ver historia clínica →
                    </Link>
                  </div>
                </section>
              )}

              <section>
                <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2">Problema reportado</p>
                <p className="text-[12.5px] text-[#3a4150] leading-relaxed bg-white border border-[#f0f1f4] rounded-[8px] px-3 py-2">
                  {ot.descripcion}
                </p>
              </section>

              {ot.diagnostico?.trim() && (
                <section>
                  <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2">Diagnóstico / trabajo realizado</p>
                  <p className="text-[12.5px] text-[#3a4150] leading-relaxed bg-white border border-[#f0f1f4] rounded-[8px] px-3 py-2 whitespace-pre-wrap">
                    {ot.diagnostico}
                  </p>
                </section>
              )}

              {repuestos.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2">Repuestos y materiales</p>
                  <ul className="space-y-1.5">
                    {repuestos.map((r: any) => (
                      <li key={r.id} className="flex items-start justify-between gap-2 text-[11.5px] border border-[#f0f1f4] rounded-[6px] px-2.5 py-1.5 bg-white">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#1f242c]">{r.descripcion}</p>
                          {r.inventario?.sku && (
                            <p className="text-[10px] text-[#9aa1ab] font-mono">SKU {r.inventario.sku}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-[#3a4150]">{r.cantidad} × {formatMonto(r.precioUnit)}</p>
                          <p className="text-[10px] text-[#198754] font-semibold">{formatMonto(r.cantidad * r.precioUnit)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] font-bold text-[#3a4150] text-right mt-2">
                    Total repuestos: {formatMonto(totalRepuestos)}
                  </p>
                </section>
              )}

              {ot.historial?.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2 flex items-center gap-1">
                    <Clock size={11} /> Cronología del trabajo
                  </p>
                  <OTTimeline historial={ot.historial} tecnicoNombre={ot.tecnico?.nombre} />
                </section>
              )}

              {(ot.presupuestos?.length > 0 || ot.factura) && (
                <section>
                  <p className="text-[10px] font-bold text-[#8a909a] uppercase mb-2 flex items-center gap-1">
                    <User size={11} /> Comercial vinculado
                  </p>
                  <div className="space-y-1 text-[12px]">
                    {ot.presupuestos?.map((p: any) => (
                      <Link
                        key={p.id}
                        href={`/presupuestos/${p.id}`}
                        className="block text-[#E8650A] font-semibold hover:underline"
                      >
                        Presupuesto {p.numero} ({p.estado})
                      </Link>
                    ))}
                    {ot.factura && (
                      <Link
                        href={`/facturacion?f=${ot.factura.id}`}
                        className="block text-[#E8650A] font-semibold hover:underline"
                      >
                        Factura {ot.factura.numero}
                      </Link>
                    )}
                  </div>
                </section>
              )}

              <Link
                href={`/servicio-tecnico/${ot.id}`}
                className="inline-block text-[11px] font-bold text-[#E8650A] hover:underline"
              >
                Abrir OT completa en Servicio técnico →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
