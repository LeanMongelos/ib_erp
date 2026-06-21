'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Calendar, CheckCircle2, Plus, Battery, Eye } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatFecha } from '@/lib/utils'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { EquipoFichaDrawer, EquipoFichaInline } from '@/components/servicio-tecnico/EquipoFichaTecnico'

interface Plan {
  id: string
  descripcion: string
  intervaloDias: number
  proximoServicio: string | null
  ultimoServicio: string | null
  estado: string
  notas?: string | null
  equipo?: { id: string; nombre: string; cliente?: { nombre: string } }
  tecnico?: { nombre: string } | null
  otPreventiva?: { id: string; numero: string } | null
}

interface Equipo {
  id: string
  nombre: string
  cliente?: { nombre: string }
}

interface Tecnico {
  id: string
  nombre: string
}

const ESTADO: Record<string, { label: string; cls: string }> = {
  PENDIENTE:   { label: 'Pendiente',   cls: 'bg-gray-100 text-gray-600' },
  PROGRAMADO:  { label: 'Programado',  cls: 'bg-blue-100 text-blue-700' },
  COMPLETADO:  { label: 'Completado',  cls: 'bg-green-100 text-green-700' },
  VENCIDO:     { label: 'Vencido',     cls: 'bg-red-100 text-red-700' },
  CANCELADO:   { label: 'Cancelado',   cls: 'bg-gray-100 text-gray-500' },
}

export function PreventivoManager({ equipos, tecnicos }: { equipos: Equipo[]; tecnicos: Tecnico[] }) {
  const router = useRouter()
  const puedeAgendar = useCan('preventivo.schedule')
  const puedeCompletar = useCan('preventivo.complete')
  const [planes, setPlanes] = useState<Plan[]>([])
  const [alertasComponentes, setAlertasComponentes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [fichaEquipoId, setFichaEquipoId] = useState<string | null>(null)
  const [fichaSubtitle, setFichaSubtitle] = useState<string | undefined>()

  async function cargar() {
    setLoading(true)
    try {
      const [data, alertas] = await Promise.all([
        fetch('/api/mantenimiento').then((r) => r.json()),
        fetch('/api/equipos/alertas').then((r) => r.json()).catch(() => []),
      ])
      setPlanes(data)
      setAlertasComponentes(Array.isArray(alertas) ? alertas : [])
    } catch {
      toast.error('Error al cargar planes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function completar(id: string) {
    const res = await fetch(`/api/mantenimiento/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'COMPLETADO' }),
    })
    if (res.ok) {
      toast.success('Servicio registrado — próximo turno agendado')
      cargar()
      router.refresh()
    } else toast.error('No se pudo completar')
  }

  function abrirFicha(equipoId: string, nombre?: string, planDesc?: string) {
    setFichaEquipoId(equipoId)
    setFichaSubtitle(
      [nombre, planDesc].filter(Boolean).join(' · ') || undefined,
    )
  }

  const proximos = [...planes].sort((a, b) => {
    const da = a.proximoServicio ? new Date(a.proximoServicio).getTime() : Infinity
    const db = b.proximoServicio ? new Date(b.proximoServicio).getTime() : Infinity
    return da - db
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-[#7c828c]">{planes.length} planes de mantenimiento preventivo</p>
        {puedeAgendar && (
          <Button variant="primary" size="sm" onClick={() => setModal(true)}>
            <Plus size={15} /> Nuevo plan
          </Button>
        )}
      </div>

      {alertasComponentes.length > 0 && (
        <Card className="border-[#FDBA74] bg-[#FFF7ED]">
          <div className="flex items-center gap-2 mb-3">
            <Battery size={16} className="text-[#C2410C]" />
            <h3 className="text-[13px] font-bold text-[#9A3412]">Componentes por vencer (baterías, filtros, calibraciones)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase text-[#C2410C]">
                  <th className="text-left pb-2">Equipo</th>
                  <th className="text-left pb-2">Cliente</th>
                  <th className="text-left pb-2">Componente</th>
                  <th className="text-right pb-2">Vence</th>
                  <th className="text-right pb-2">Días</th>
                </tr>
              </thead>
              <tbody>
                {alertasComponentes.slice(0, 15).map((a: any) => (
                  <tr key={a.id} className="border-t border-[#FED7AA]">
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => abrirFicha(a.equipoId, a.equipo?.nombre, a.descripcion)}
                        className="font-semibold text-[#E8650A] hover:underline text-left"
                      >
                        {a.equipo?.nombre}
                      </button>
                    </td>
                    <td className="py-2">{a.equipo?.cliente?.nombre ?? '—'}</td>
                    <td className="py-2">{a.descripcion}</td>
                    <td className="py-2 text-right">{a.venceEn ? formatFecha(a.venceEn) : '—'}</td>
                    <td className={`py-2 text-right font-bold ${a.vencido ? 'text-red-700' : a.urgente ? 'text-amber-700' : ''}`}>
                      {a.vencido ? `Vencido ${Math.abs(a.diffDias)}d` : `${a.diffDias}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {loading ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Equipo / Cliente', 'Descripción', 'Próximo', 'Intervalo', 'Técnico', 'Estado', 'OT / Acción', 'Ficha', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proximos.map((p, i) => {
                  const st = ESTADO[p.estado] ?? { label: p.estado, cls: 'bg-gray-100 text-gray-600' }
                  const vencido = p.proximoServicio && new Date(p.proximoServicio) < new Date()
                  return (
                    <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                        <button
                          type="button"
                          onClick={() => p.equipo?.id && abrirFicha(p.equipo.id, p.equipo.nombre, p.descripcion)}
                          className="text-left group"
                          disabled={!p.equipo?.id}
                        >
                          <p className="text-[12.5px] font-bold text-[#1f242c] group-hover:text-[#E8650A] transition-colors">
                            {p.equipo?.nombre ?? '—'}
                          </p>
                          <p className="text-[11px] text-[#9aa1ab]">{p.equipo?.cliente?.nombre}</p>
                        </button>
                      </td>
                      <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{p.descripcion}</td>
                      <td className={`px-5 py-[13px] text-[12.5px] border-b border-[#f4f5f7] ${vencido ? 'text-red-600 font-bold' : 'text-[#3a4150]'}`}>
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={13} />
                          {p.proximoServicio ? formatFecha(p.proximoServicio) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-[13px] text-[12px] text-[#9aa1ab] border-b border-[#f4f5f7]">{p.intervaloDias} días</td>
                      <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{p.tecnico?.nombre ?? '—'}</td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7] text-[12px]">
                        {p.otPreventiva ? (
                          <Link href={`/servicio-tecnico/${p.otPreventiva.id}`} className="text-[#E8650A] font-semibold hover:underline">
                            OT {p.otPreventiva.numero}
                          </Link>
                        ) : p.notas?.includes('factura') ? (
                          <span className="text-[11px] text-[#9aa1ab]">Venta · sin OT abierta</span>
                        ) : (
                          <span className="text-[11px] text-[#9aa1ab]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7] text-right">
                        {p.equipo?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirFicha(p.equipo!.id, p.equipo!.nombre, p.descripcion)}
                            title="Ver ficha completa del equipo"
                          >
                            <Eye size={14} /> Ver ficha
                          </Button>
                        )}
                      </td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7] text-right">
                        {puedeCompletar && !['CANCELADO'].includes(p.estado) && (
                          <Button variant="outline" size="sm" onClick={() => completar(p.id)}>
                            <CheckCircle2 size={14} /> Completar
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {planes.length === 0 && (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">Sin planes programados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && (
        <NuevoPlanModal
          equipos={equipos}
          tecnicos={tecnicos}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); cargar(); router.refresh() }}
        />
      )}

      <EquipoFichaDrawer
        open={!!fichaEquipoId}
        equipoId={fichaEquipoId}
        subtitle={fichaSubtitle}
        onClose={() => { setFichaEquipoId(null); setFichaSubtitle(undefined) }}
      />
    </div>
  )
}

function NuevoPlanModal({ equipos, tecnicos, onClose, onSaved }: {
  equipos: Equipo[]
  tecnicos: Tecnico[]
  onClose: () => void
  onSaved: () => void
}) {
  const [equipoId, setEquipoId] = useState('')
  const [descripcion, setDescripcion] = useState('Mantenimiento preventivo semestral')
  const [intervaloDias, setIntervaloDias] = useState(180)
  const [tecnicoId, setTecnicoId] = useState('')
  const [loading, setLoading] = useState(false)

  async function guardar() {
    if (!equipoId) { toast.error('Seleccioná un equipo'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/mantenimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipoId,
          descripcion,
          intervaloDias,
          tecnicoId: tecnicoId || undefined,
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo crear el plan preventivo'))
      toast.success('Plan creado')
      onSaved()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo crear el plan preventivo'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[14px] w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#eef0f2] shrink-0">
          <h3 className="text-[14px] font-bold">Nuevo plan preventivo</h3>
        </div>
        <div className="p-5 flex flex-col gap-3.5 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Equipo</label>
            <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)}
              className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px]">
              <option value="">Seleccionar…</option>
              {equipos.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre} — {e.cliente?.nombre}</option>
              ))}
            </select>
          </div>
          {equipoId && (
            <div className="rounded-[10px] border border-[#e4e7eb] bg-[#fafbfc] p-3 max-h-[40vh] overflow-y-auto">
              <p className="text-[10.5px] font-bold uppercase text-[#8a909a] mb-2">Vista previa — datos del ERP</p>
              <EquipoFichaInline equipoId={equipoId} />
            </div>
          )}
          <Input label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          <Input label="Intervalo (días)" type="number" value={intervaloDias} onChange={(e) => setIntervaloDias(Number(e.target.value))} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Técnico (opcional)</label>
            <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}
              className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px]">
              <option value="">Sin asignar</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[#eef0f2] flex justify-end gap-2 shrink-0">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} loading={loading}>Crear plan</Button>
        </div>
      </div>
    </div>
  )
}
