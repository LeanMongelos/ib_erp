'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { MapPin, Route, Plus, RefreshCw, Navigation, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatFecha } from '@/lib/utils'
import { useCan } from '@/components/auth/useCan'
import { abrirGoogleMaps, googleMapsNavegar, googleMapsRecorrido, googleMapsVerUbicacion } from '@/lib/google-maps'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

const MapaLeaflet = dynamic(() => import('./MapaLeaflet'), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] bg-[#eef0f2] rounded-[10px] flex items-center justify-center text-[13px] text-[#9aa1ab]">
      Cargando mapa…
    </div>
  ),
})

async function fetchJsonConTimeout(url: string, ms = 15_000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { credentials: 'include', signal: controller.signal })
    if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar el mapa'))
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } finally {
    window.clearTimeout(timer)
  }
}

interface EquipoMapa {
  id: string
  nombre: string
  numeroSerie: string | null
  estado: string
  lat: number
  lng: number
  direccion: string | null
  cliente: { id: string; nombre: string; ciudad: string | null }
  mantenimientoProximoDias: number | null
  mantenimientoVencido: boolean
}

interface EquipoOption {
  id: string
  nombre: string
  numeroSerie: string | null
  cliente?: { nombre: string }
}

interface EventoRecorrido {
  id: string
  tipo: string
  lat: number
  lng: number
  direccion: string | null
  nota: string | null
  fecha: string
  usuario?: { nombre: string } | null
}

const TIPOS = [
  'RECEPCION', 'DEPOSITO', 'EN_TRANSITO', 'INSTALADO', 'EN_SERVICIO', 'RETIRO', 'BAJA',
] as const

const TIPO_LABEL: Record<string, string> = {
  RECEPCION: 'Recepción',
  DEPOSITO: 'Depósito',
  EN_TRANSITO: 'En tránsito',
  INSTALADO: 'Instalado',
  EN_SERVICIO: 'En servicio',
  RETIRO: 'Retiro',
  BAJA: 'Baja',
}

export function TrackingMap({ equiposIniciales }: { equiposIniciales: EquipoOption[] }) {
  const puedeRegistrar = useCan('tracking.create')
  const [equipos, setEquipos] = useState<EquipoMapa[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [recorrido, setRecorrido] = useState<EventoRecorrido[]>([])
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [modal, setModal] = useState(false)

  async function cargarMapa() {
    setLoading(true)
    try {
      const q = filtroEstado !== 'TODOS' ? `?estado=${filtroEstado}` : ''
      const data = await fetchJsonConTimeout(`/api/tracking/mapa${q}`)
      setEquipos(data)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar el mapa'))
      setEquipos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarMapa() }, [filtroEstado])

  async function cargarRecorrido(equipoId: string) {
    setSeleccionado(equipoId)
    try {
      const data = await fetch(`/api/tracking/equipo/${equipoId}`).then((r) => r.json())
      setRecorrido(data.recorrido ?? [])
    } catch {
      setRecorrido([])
    }
  }

  const equipoSel = useMemo(
    () => equipos.find((e) => e.id === seleccionado),
    [equipos, seleccionado],
  )

  const puntosRecorrido = recorrido.map((e) => [e.lat, e.lng] as [number, number])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-[#E8650A]" />
          <p className="text-[13px] text-[#5b626d]">
            {loading ? 'Cargando…' : `${equipos.length} equipos geolocalizados`}
            <span className="text-[#9aa1ab]"> · mapa interno · navegación en Google Maps</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[12.5px]"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="EN_REPARACION">En reparación</option>
            <option value="BAJA">Baja</option>
          </select>
          <button onClick={cargarMapa} className="text-[12px] text-[#6b7280] hover:text-[#E8650A] inline-flex items-center gap-1 px-2">
            <RefreshCw size={14} /> Actualizar
          </button>
          {puedeRegistrar && (
            <Button variant="primary" size="sm" onClick={() => setModal(true)}>
              <Plus size={15} /> Registrar evento
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card padding={false} className="overflow-hidden">
            <MapaLeaflet
              equipos={equipos}
              seleccionado={seleccionado}
              puntosRecorrido={puntosRecorrido}
              onSelect={cargarRecorrido}
            />
          </Card>
        </div>

        <Card className="col-span-1 max-h-[520px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <Route size={16} className="text-[#E8650A]" />
            <h3 className="text-[13.5px] font-bold text-[#1f242c]">Recorrido</h3>
          </div>
          {!seleccionado && (
            <p className="text-[12.5px] text-[#9aa1ab]">Hacé clic en un pin del mapa para ver el historial geográfico.</p>
          )}
          {equipoSel && (
            <div className="mb-3 space-y-2">
              <p className="text-[12px] font-semibold text-[#3a4150]">
                {equipoSel.nombre}
                {equipoSel.numeroSerie && <span className="text-[#9aa1ab] font-normal"> · {equipoSel.numeroSerie}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => abrirGoogleMaps(googleMapsNavegar({
                    lat: equipoSel.lat,
                    lng: equipoSel.lng,
                    label: `${equipoSel.nombre} — ${equipoSel.cliente.nombre}`,
                  }))}
                >
                  <Navigation size={14} /> Ir con Google Maps
                </Button>
                {recorrido.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirGoogleMaps(googleMapsRecorrido(recorrido.map((e) => ({ lat: e.lat, lng: e.lng }))))}
                  >
                    <Route size={14} /> Recorrido completo
                  </Button>
                )}
              </div>
            </div>
          )}
          {!equipoSel && seleccionado && null}
          <ol className="space-y-3">
            {recorrido.map((ev) => (
              <li key={ev.id} className="border-l-2 border-[#E8650A] pl-3">
                <p className="text-[12px] font-bold text-[#1f242c]">{TIPO_LABEL[ev.tipo] ?? ev.tipo}</p>
                <p className="text-[11px] text-[#9aa1ab]">{formatFecha(ev.fecha)}</p>
                {ev.direccion && <p className="text-[11.5px] text-[#6b7280] mt-0.5">{ev.direccion}</p>}
                {ev.nota && <p className="text-[11px] text-[#9aa1ab] italic">{ev.nota}</p>}
                <button
                  type="button"
                  onClick={() => abrirGoogleMaps(googleMapsNavegar({ lat: ev.lat, lng: ev.lng, label: ev.direccion ?? undefined }))}
                  className="mt-1.5 text-[11px] font-semibold text-[#4285F4] hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink size={11} /> Google Maps
                </button>
              </li>
            ))}
            {seleccionado && recorrido.length === 0 && (
              <li className="text-[12px] text-[#9aa1ab]">Sin eventos registrados aún.</li>
            )}
          </ol>
        </Card>
      </div>

      {modal && (
        <RegistrarEventoModal
          equipos={equiposIniciales}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); cargarMapa(); if (seleccionado) cargarRecorrido(seleccionado) }}
        />
      )}
    </div>
  )
}

function RegistrarEventoModal({
  equipos,
  onClose,
  onSaved,
}: {
  equipos: EquipoOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [equipoId, setEquipoId] = useState('')
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('INSTALADO')
  const [lat, setLat] = useState('-26.1849')
  const [lng, setLng] = useState('-58.1731')
  const [direccion, setDireccion] = useState('')
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)

  async function geocodificar() {
    if (!direccion.trim()) { toast.error('Ingresá una dirección'); return }
    setGeocoding(true)
    try {
      const params = new URLSearchParams({
        direccion: direccion.trim(),
        ciudad: 'Formosa',
      })
      const res = await fetch(`/api/geocoding?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('No se encontró la dirección')
      const data = await res.json()
      setLat(String(data.lat))
      setLng(String(data.lng))
      toast.success('Ubicación encontrada')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo geocodificar la dirección'))
    } finally {
      setGeocoding(false)
    }
  }

  async function guardar() {
    if (!equipoId) { toast.error('Seleccioná un equipo'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipoId,
          tipo,
          lat: Number(lat),
          lng: Number(lng),
          direccion: direccion || undefined,
          nota: nota || undefined,
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo registrar el evento de tracking'))
      toast.success('Evento registrado')
      onSaved()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo registrar el evento de tracking'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[14px] w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#eef0f2]">
          <h3 className="text-[14px] font-bold">Registrar evento de tracking</h3>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Equipo</label>
            <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)}
              className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px]">
              <option value="">Seleccionar…</option>
              {equipos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} {e.numeroSerie ? `(${e.numeroSerie})` : ''} — {e.cliente?.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Tipo de evento</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as (typeof TIPOS)[number])}
              className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px]">
              {TIPOS.map((t) => (
                <option key={t} value={t}>{TIPO_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Dirección</label>
            <div className="flex gap-2">
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)}
                placeholder="Ej. Av. 25 de Mayo 1234, Formosa"
                className="flex-1 border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px]" />
              <Button variant="outline" size="sm" onClick={geocodificar} loading={geocoding}>Buscar</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Latitud</label>
              <input value={lat} onChange={(e) => setLat(e.target.value)} className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Longitud</label>
              <input value={lng} onChange={(e) => setLng(e.target.value)} className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px]" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Nota (opcional)</label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
              className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] resize-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[#eef0f2] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} loading={loading}>Registrar</Button>
        </div>
      </div>
    </div>
  )
}
