'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Search, Send, UserPlus, Wrench, FileText, Tag, Phone, Mail,
  MessageCircle, Camera, Globe, Zap, ChevronRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatFecha } from '@/lib/utils'
import { useCan } from '@/components/auth/useCan'
import { ClienteProspectoModal, parseProspectoDesdeConversacion } from '@/components/crm/ClienteProspectoModal'
import { ClienteHistorialInbox } from '@/components/crm/ClienteHistorialInbox'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface Conversacion {
  id: string
  estado: string
  contactoNombre: string
  contactoHandle: string
  preview: string | null
  sinLeer: number
  etiquetas: string[]
  ultimoMensajeEn: string
  canal?: { tipo: string; nombre: string }
  cliente?: { id: string; nombre: string } | null
  asignado?: { nombre: string } | null
}

interface Mensaje {
  id: string
  direccion: string
  contenido: string
  fecha: string
  usuario?: { nombre: string } | null
}

interface Detalle extends Conversacion {
  mensajes: Mensaje[]
  cliente?: { id: string; nombre: string; telefono?: string | null; email?: string | null; tipo?: string } | null
}

const CANAL_META: Record<string, { icon: typeof MessageCircle; color: string; label: string }> = {
  WHATSAPP: { icon: MessageCircle, color: '#25D366', label: 'WhatsApp' },
  INSTAGRAM: { icon: Camera, color: '#E4405F', label: 'Instagram' },
  FACEBOOK: { icon: Globe, color: '#1877F2', label: 'Facebook' },
  EMAIL_IMAP: { icon: Mail, color: '#6b7280', label: 'Email' },
  EMAIL_GRAPH: { icon: Mail, color: '#0078D4', label: 'Email 365' },
}

const ETIQUETAS = ['venta', 'soporte', 'reclamo', 'presupuesto', 'urgente']

export function InboxPanel({ usuarios }: { usuarios: { id: string; nombre: string }[] }) {
  const puedeResponder = useCan('crm.reply')
  const puedeAsignar = useCan('crm.assign')
  const [lista, setLista] = useState<Conversacion[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [filtroCanal, setFiltroCanal] = useState('TODOS')
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [modalCliente, setModalCliente] = useState(false)
  const hiloRef = useRef<HTMLDivElement>(null)

  async function cargarLista() {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (filtroCanal !== 'TODOS') q.set('canal', filtroCanal)
      if (filtroEstado !== 'TODOS') q.set('estado', filtroEstado)
      const data = await fetch(`/api/crm/conversaciones?${q}`).then((r) => r.json())
      setLista(data)
    } catch {
      toast.error('Error al cargar bandeja')
    } finally {
      setLoading(false)
    }
  }

  async function cargarDetalle(id: string) {
    setSelId(id)
    try {
      const data = await fetch(`/api/crm/conversaciones/${id}`).then((r) => r.json())
      setDetalle(data)
      setLista((prev) => prev.map((c) => (c.id === id ? { ...c, sinLeer: 0 } : c)))
    } catch {
      toast.error('Error al abrir conversación')
    }
  }

  useEffect(() => { cargarLista() }, [filtroCanal, filtroEstado])
  useEffect(() => {
    hiloRef.current?.scrollTo({ top: hiloRef.current.scrollHeight })
  }, [detalle?.mensajes])

  async function enviar() {
    if (!selId || !texto.trim()) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/crm/conversaciones/${selId}/mensajes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: texto }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo enviar el mensaje'))
      setTexto('')
      await cargarDetalle(selId)
      cargarLista()
      if (data.pendienteEnvio) {
        toast.info('Guardado en el ERP. Conectá el canal en Integraciones para enviar al cliente.')
      } else {
        toast.success('Mensaje enviado')
      }
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo enviar el mensaje'))
    } finally {
      setEnviando(false)
    }
  }

  async function toggleEtiqueta(tag: string) {
    if (!selId || !detalle || !puedeAsignar) return
    const tags = detalle.etiquetas.includes(tag)
      ? detalle.etiquetas.filter((t) => t !== tag)
      : [...detalle.etiquetas, tag]
    const res = await fetch(`/api/crm/conversaciones/${selId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etiquetas: tags }),
    })
    if (res.ok) {
      const updated = await res.json()
      setDetalle((d) => d ? { ...d, etiquetas: updated.etiquetas } : d)
      cargarLista()
    }
  }

  async function vincularCliente(cliente: { id: string; nombre: string }) {
    if (!selId) return
    try {
      const res = await fetch(`/api/crm/conversaciones/${selId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: cliente.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo vincular el cliente'))
      toast.success(`Vinculado a ${cliente.nombre}`)
      await cargarDetalle(selId)
      cargarLista()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo vincular el cliente'))
    }
  }

  function accionHref(base: string) {
    if (!detalle?.cliente?.id) return base
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}clienteId=${encodeURIComponent(detalle.cliente.id)}`
  }

  const prospectoPrefill = detalle
    ? parseProspectoDesdeConversacion(detalle.contactoNombre, detalle.contactoHandle)
    : { nombre: '' }

  const filtradas = lista.filter((c) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      c.contactoNombre.toLowerCase().includes(q) ||
      c.contactoHandle.toLowerCase().includes(q) ||
      (c.preview ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-220px)] min-h-[560px]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="text-[#9aa1ab]" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar conversación…"
            className="flex-1 text-[12.5px] bg-transparent border-none outline-none"
          />
        </div>
        <select value={filtroCanal} onChange={(e) => setFiltroCanal(e.target.value)}
          className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[12px]">
          <option value="TODOS">Todos los canales</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="INSTAGRAM">Instagram</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="EMAIL_IMAP">Email</option>
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
          className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[12px]">
          <option value="TODOS">Todos</option>
          <option value="ABIERTA">Abiertas</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="CERRADA">Cerradas</option>
        </select>
        <Link href="/configuracion/integraciones">
          <Button variant="outline" size="sm">Conectar canales</Button>
        </Link>
      </div>

      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Lista */}
        <Card padding={false} className="col-span-3 overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b border-[#f0f1f4] text-[11px] font-bold text-[#8a909a] uppercase">
            {loading ? 'Cargando…' : `${filtradas.length} conversaciones`}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtradas.map((c) => {
              const meta = CANAL_META[c.canal?.tipo ?? ''] ?? CANAL_META.EMAIL_IMAP
              const Icon = meta.icon
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => cargarDetalle(c.id)}
                  className={`w-full text-left px-3 py-3 border-b border-[#f4f5f7] hover:bg-[#fafbfc] transition-colors ${selId === c.id ? 'bg-[#FFF8F2] border-l-[3px] border-l-[#E8650A]' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon size={16} style={{ color: meta.color }} className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12.5px] font-bold text-[#1f242c] truncate">{c.contactoNombre}</span>
                        {c.sinLeer > 0 && (
                          <span className="bg-[#E8650A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{c.sinLeer}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#9aa1ab] truncate">{c.contactoHandle}</p>
                      <p className="text-[11.5px] text-[#6b7280] truncate mt-0.5">{c.preview}</p>
                    </div>
                  </div>
                </button>
              )
            })}
            {!loading && filtradas.length === 0 && (
              <p className="p-4 text-[12px] text-[#9aa1ab] text-center">Sin conversaciones</p>
            )}
          </div>
        </Card>

        {/* Hilo */}
        <Card padding={false} className="col-span-5 flex flex-col overflow-hidden">
          {!detalle ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-[#9aa1ab] p-6 text-center">
              Seleccioná una conversación para ver el hilo y responder por el canal correspondiente.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-[#f0f1f4] flex items-center justify-between">
                <div>
                  <p className="text-[13.5px] font-bold text-[#1f242c]">{detalle.contactoNombre}</p>
                  <p className="text-[11.5px] text-[#9aa1ab]">{detalle.contactoHandle} · {detalle.canal?.nombre}</p>
                </div>
                <Badge variant={detalle.estado === 'ABIERTA' ? 'success' : detalle.estado === 'PENDIENTE' ? 'warning' : 'gray'}>
                  {detalle.estado}
                </Badge>
              </div>
              <div ref={hiloRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8f9fb]">
                {detalle.mensajes.map((m) => (
                  <div key={m.id} className={`flex ${m.direccion === 'SALIENTE' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-[12px] px-3.5 py-2.5 ${
                      m.direccion === 'SALIENTE'
                        ? 'bg-[#E8650A] text-white rounded-br-sm'
                        : 'bg-white border border-[#e4e7eb] text-[#1f242c] rounded-bl-sm'
                    }`}>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.contenido}</p>
                      <p className={`text-[10px] mt-1 ${m.direccion === 'SALIENTE' ? 'text-orange-100' : 'text-[#9aa1ab]'}`}>
                        {formatFecha(m.fecha)}
                        {m.usuario?.nombre && ` · ${m.usuario.nombre}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {puedeResponder && (
                <div className="p-3 border-t border-[#f0f1f4] flex gap-2">
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Escribí tu respuesta…"
                    rows={2}
                    className="flex-1 border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[#E8650A]/30"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  />
                  <Button variant="primary" onClick={enviar} loading={enviando} disabled={!texto.trim()}>
                    <Send size={16} />
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Panel lateral */}
        <Card className="col-span-4 overflow-y-auto">
          {!detalle ? (
            <div className="text-[12.5px] text-[#9aa1ab] leading-relaxed">
              <p className="font-bold text-[#3a4150] mb-2">Bandeja omnicanal</p>
              <p>WhatsApp, Instagram, Facebook y correo en un solo lugar.</p>
              <p className="mt-3">Conectá los canales en <Link href="/configuracion/integraciones" className="text-[#E8650A] font-semibold hover:underline">Integraciones</Link> siguiendo el asistente paso a paso.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[10.5px] font-bold text-[#8a909a] uppercase mb-2">Cliente</p>
                {detalle.cliente ? (
                  <Link href={`/crm/${detalle.cliente.id}`} className="text-[13px] font-bold text-[#E8650A] hover:underline flex items-center gap-1">
                    {detalle.cliente.nombre} <ChevronRight size={14} />
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setModalCliente(true)}
                  >
                    <UserPlus size={14} /> Agregar como cliente
                  </Button>
                )}
              </div>

              <div>
                <p className="text-[10.5px] font-bold text-[#8a909a] uppercase mb-2">Etiquetas</p>
                <div className="flex flex-wrap gap-1.5">
                  {ETIQUETAS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleEtiqueta(tag)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        detalle.etiquetas.includes(tag)
                          ? 'bg-[#FFF1E2] border-[#E8650A] text-[#C4540A]'
                          : 'bg-white border-[#e4e7eb] text-[#6b7280] hover:border-[#E8650A]'
                      }`}
                    >
                      <Tag size={10} className="inline mr-1" />{tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10.5px] font-bold text-[#8a909a] uppercase mb-2">Acciones rápidas</p>
                <div className="grid grid-cols-2 gap-2">
                  {detalle.cliente ? (
                    <>
                      <Link href={accionHref('/presupuestos/nuevo')}>
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          <FileText size={14} /> Presupuesto
                        </Button>
                      </Link>
                      <Link href={accionHref('/servicio-tecnico/nueva')}>
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          <Wrench size={14} /> Crear OT
                        </Button>
                      </Link>
                      <Link href={accionHref('/servicio-tecnico/preventivo')}>
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          <Phone size={14} /> Preventivo
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" className="w-full justify-start opacity-50 cursor-not-allowed" disabled>
                        <FileText size={14} /> Presupuesto
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start opacity-50 cursor-not-allowed" disabled>
                        <Wrench size={14} /> Crear OT
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start opacity-50 cursor-not-allowed" disabled>
                        <Phone size={14} /> Preventivo
                      </Button>
                    </>
                  )}
                  <Link href={accionHref('/servicio-tecnico/mapa')}>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Zap size={14} /> Ver en mapa
                    </Button>
                  </Link>
                </div>
                {!detalle.cliente && (
                  <p className="text-[11px] text-[#9aa1ab] mt-1.5">
                    Vinculá un cliente para abrir presupuesto u OT con sus datos.
                  </p>
                )}
              </div>

              {puedeAsignar && (
                <div>
                  <p className="text-[10.5px] font-bold text-[#8a909a] uppercase mb-2">Asignado a</p>
                  <select
                    className="w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[12.5px]"
                    value={detalle.asignado?.nombre ? usuarios.find((u) => u.nombre === detalle.asignado?.nombre)?.id ?? '' : ''}
                    onChange={async (e) => {
                      if (!selId) return
                      await fetch(`/api/crm/conversaciones/${selId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ asignadoId: e.target.value || null }),
                      })
                      cargarDetalle(selId)
                    }}
                  >
                    <option value="">Sin asignar</option>
                    {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </div>
              )}

              {detalle.cliente && (
                <div className="border-t border-[#f0f1f4] pt-4">
                  <p className="text-[10.5px] font-bold text-[#8a909a] uppercase mb-2">Historial del cliente</p>
                  <ClienteHistorialInbox key={detalle.cliente.id} clienteId={detalle.cliente.id} />
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <ClienteProspectoModal
        open={modalCliente}
        prefill={prospectoPrefill}
        onClose={() => setModalCliente(false)}
        onVinculado={vincularCliente}
      />
    </div>
  )
}
