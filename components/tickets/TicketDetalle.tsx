'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { BadgeEstadoTicket, BadgePrioridad } from '@/components/ui/badge'
import { TicketTimeline } from '@/components/tickets/TicketTimeline'
import { formatFechaHora } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { ESTADOS_TICKET, labelAreaTicket, labelTipoTicket } from '@/lib/tickets/constants'
import { useCan } from '@/components/auth/useCan'

interface UsuarioMini {
  id: string
  nombre: string
  email?: string
}

interface Comentario {
  id: string
  texto: string
  esInterno: boolean
  creadoEn: string
  usuario: { id: string; nombre: string }
}

interface TicketDetalleData {
  id: string
  numero: string
  titulo: string
  descripcion: string
  tipo: string
  areaOrigen: string
  areaDestino: string
  estado: string
  prioridad: string
  resolucion?: string | null
  creadoEn: string
  cerradoEn?: string | null
  solicitante: UsuarioMini
  asignado?: UsuarioMini | null
  comentarios: Comentario[]
  historial: {
    id: string
    estado: string
    nota?: string | null
    creadoEn: string
    usuario?: { nombre: string } | null
  }[]
}

export function TicketDetalle({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const puedeAsignar = useCan('tickets.assign')
  const puedeCerrar = useCan('tickets.close')
  const puedeVerInternos = useCan('tickets.read_all')

  const [ticket, setTicket] = useState<TicketDetalleData | null>(null)
  const [asignables, setAsignables] = useState<UsuarioMini[]>([])
  const [loading, setLoading] = useState(true)
  const [comentario, setComentario] = useState('')
  const [esInterno, setEsInterno] = useState(false)
  const [resolucion, setResolucion] = useState('')
  const [notaEstado, setNotaEstado] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar solicitud'))
      const data = (await res.json()) as TicketDetalleData
      setTicket(data)
      setResolucion(data.resolucion ?? '')
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'No se pudo cargar la solicitud'))
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (!puedeAsignar) return
    fetch('/api/tickets/asignables', { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) setAsignables(await res.json())
      })
      .catch(() => null)
  }, [puedeAsignar])

  async function patchTicket(body: Record<string, unknown>) {
    setGuardando(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo actualizar'))
      toast.success('Solicitud actualizada')
      await cargar()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'Error al actualizar'))
    } finally {
      setGuardando(false)
    }
  }

  async function enviarComentario(e: React.FormEvent) {
    e.preventDefault()
    if (!comentario.trim()) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comentarios`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: comentario.trim(), esInterno }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo comentar'))
      setComentario('')
      setEsInterno(false)
      await cargar()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'Error al comentar'))
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return <p className="text-[12.5px] text-[#9aa1ab]">Cargando…</p>
  }

  if (!ticket) {
    return (
      <div>
        <p className="text-[13px] text-[#5b626d] mb-4">Solicitud no encontrada o sin permiso.</p>
        <Button variant="outline" onClick={() => router.push('/tickets')}>Volver</Button>
      </div>
    )
  }

  const cerrada = ['CERRADA', 'CANCELADA'].includes(ticket.estado)

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => router.push('/tickets')}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-[#6b7280] hover:text-[#E8650A] w-fit"
      >
        <ArrowLeft size={14} /> Volver al listado
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-mono text-[12px] text-[#E8650A] font-bold">{ticket.numero}</p>
                <h2 className="text-[18px] font-bold text-[#1f242c] mt-1">{ticket.titulo}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <BadgeEstadoTicket estado={ticket.estado} />
                <BadgePrioridad prioridad={ticket.prioridad} />
              </div>
            </div>
            <p className="text-[13px] text-[#4b5563] whitespace-pre-wrap leading-relaxed">{ticket.descripcion}</p>
            {ticket.resolucion && (
              <div className="mt-4 p-3 rounded-[8px] bg-green-50 border border-green-100">
                <p className="text-[11px] font-bold uppercase text-green-800 mb-1">Resolución</p>
                <p className="text-[13px] text-green-900 whitespace-pre-wrap">{ticket.resolucion}</p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-[13px] font-bold text-[#1f242c] mb-4">Comentarios</h3>
            <div className="flex flex-col gap-3 mb-4">
              {ticket.comentarios.length === 0 ? (
                <p className="text-[12px] text-[#9aa1ab]">Sin comentarios aún.</p>
              ) : (
                ticket.comentarios.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-[8px] px-3 py-2 border ${
                      c.esInterno ? 'bg-amber-50 border-amber-100' : 'bg-[#f9fafb] border-[#eef0f2]'
                    }`}
                  >
                    <p className="text-[12.5px] text-[#1f242c] whitespace-pre-wrap">{c.texto}</p>
                    <p className="text-[11px] text-[#9aa1ab] mt-1">
                      {c.usuario.nombre}
                      {c.esInterno && puedeVerInternos ? ' · interno' : ''}
                      {' · '}
                      {formatFechaHora(c.creadoEn)}
                    </p>
                  </div>
                ))
              )}
            </div>
            {!cerrada && (
              <form onSubmit={enviarComentario} className="flex flex-col gap-2">
                <textarea
                  rows={3}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Agregar comentario…"
                  className="w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px]"
                />
                {puedeVerInternos && (
                  <label className="flex items-center gap-2 text-[12px] text-[#5b626d]">
                    <input type="checkbox" checked={esInterno} onChange={(e) => setEsInterno(e.target.checked)} />
                    Comentario interno (solo gerencia / desarrollo)
                  </label>
                )}
                <Button type="submit" size="sm" disabled={guardando || !comentario.trim()}>
                  Comentar
                </Button>
              </form>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h3 className="text-[12px] font-bold uppercase text-[#8a909a] mb-3">Datos</h3>
            <dl className="text-[12.5px] space-y-2">
              <div><dt className="text-[#9aa1ab]">Tipo</dt><dd className="font-medium">{labelTipoTicket(ticket.tipo as never)}</dd></div>
              <div><dt className="text-[#9aa1ab]">Área origen</dt><dd className="font-medium">{labelAreaTicket(ticket.areaOrigen as never)}</dd></div>
              <div><dt className="text-[#9aa1ab]">Destino</dt><dd className="font-medium">{labelAreaTicket(ticket.areaDestino as never)}</dd></div>
              <div><dt className="text-[#9aa1ab]">Solicitante</dt><dd className="font-medium">{ticket.solicitante.nombre}</dd></div>
              <div><dt className="text-[#9aa1ab]">Asignado</dt><dd className="font-medium">{ticket.asignado?.nombre ?? 'Sin asignar'}</dd></div>
              <div><dt className="text-[#9aa1ab]">Creada</dt><dd>{formatFechaHora(ticket.creadoEn)}</dd></div>
              {ticket.cerradoEn && (
                <div><dt className="text-[#9aa1ab]">Cerrada</dt><dd>{formatFechaHora(ticket.cerradoEn)}</dd></div>
              )}
            </dl>
          </Card>

          {(puedeAsignar || puedeCerrar) && !cerrada && (
            <Card className="p-5">
              <h3 className="text-[12px] font-bold uppercase text-[#8a909a] mb-3">Gestión</h3>
              <div className="flex flex-col gap-3">
                {puedeAsignar && (
                  <>
                    <div>
                      <label className="text-[11px] font-semibold text-[#5b626d] uppercase">Asignar a</label>
                      <Select
                        value={ticket.asignado?.id ?? ''}
                        onChange={(e) => {
                          void patchTicket({ asignadoId: e.target.value || null })
                        }}
                        disabled={guardando}
                        options={[
                          { value: '', label: 'Sin asignar' },
                          ...asignables.map((u) => ({ value: u.id, label: u.nombre })),
                        ]}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#5b626d] uppercase">Estado</label>
                      <Select
                        value={ticket.estado}
                        onChange={(e) => {
                          void patchTicket({ estado: e.target.value, nota: notaEstado || undefined })
                        }}
                        disabled={guardando}
                        options={ESTADOS_TICKET.map((s) => ({ value: s.value, label: s.label }))}
                        className="mt-1"
                      />
                    </div>
                    <input
                      type="text"
                      value={notaEstado}
                      onChange={(e) => setNotaEstado(e.target.value)}
                      placeholder="Nota opcional al cambiar estado"
                      className="w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[12px]"
                    />
                    <div>
                      <label className="text-[11px] font-semibold text-[#5b626d] uppercase">Prioridad</label>
                      <Select
                        value={ticket.prioridad}
                        onChange={(e) => void patchTicket({ prioridad: e.target.value })}
                        disabled={guardando}
                        options={[
                          { value: 'BAJA', label: 'Baja' },
                          { value: 'NORMAL', label: 'Normal' },
                          { value: 'ALTA', label: 'Alta' },
                          { value: 'URGENTE', label: 'Urgente' },
                        ]}
                        className="mt-1"
                      />
                    </div>
                  </>
                )}
                {puedeCerrar && (
                  <div>
                    <label className="text-[11px] font-semibold text-[#5b626d] uppercase">Resolución</label>
                    <textarea
                      rows={3}
                      value={resolucion}
                      onChange={(e) => setResolucion(e.target.value)}
                      placeholder="Qué se hizo para resolver el pedido"
                      className="mt-1 w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[12px]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2 w-full"
                      disabled={guardando || !resolucion.trim()}
                      onClick={() =>
                        void patchTicket({
                          resolucion: resolucion.trim(),
                          estado: 'CERRADA',
                          nota: 'Solicitud cerrada',
                        })
                      }
                    >
                      Cerrar solicitud
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="text-[12px] font-bold uppercase text-[#8a909a] mb-3">Historial</h3>
            <TicketTimeline historial={ticket.historial} />
          </Card>
        </div>
      </div>
    </div>
  )
}
