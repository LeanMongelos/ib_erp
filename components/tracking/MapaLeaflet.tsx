'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { abrirGoogleMaps, googleMapsNavegar } from '@/lib/google-maps'

interface EquipoMapa {
  id: string
  nombre: string
  numeroSerie: string | null
  estado: string
  origen?: string
  lat: number
  lng: number
  direccion: string | null
  cliente: { nombre: string; ciudad: string | null }
  beneficiario?: string | null
  mantenimientoVencido: boolean
}

interface Props {
  equipos: EquipoMapa[]
  seleccionado: string | null
  puntosRecorrido: [number, number][]
  onSelect: (id: string) => void
}

const CENTRO: [number, number] = [-26.1849, -58.1731]

function icono(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

const ICONO = {
  ACTIVO: icono('#22c55e'),
  EN_REPARACION: icono('#f97316'),
  BAJA: icono('#9ca3af'),
  MANT_VENCIDO: icono('#ef4444'),
  ALQUILER: icono('#3b82f6'),
}

function iconoEquipo(e: EquipoMapa) {
  if (e.mantenimientoVencido) return ICONO.MANT_VENCIDO
  if (e.origen === 'ALQUILER') return ICONO.ALQUILER
  return ICONO[e.estado as keyof typeof ICONO] ?? ICONO.ACTIVO
}

function AjustarVista({ equipos, puntos }: { equipos: EquipoMapa[]; puntos: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    const coords = puntos.length > 1
      ? puntos
      : equipos.map((e) => [e.lat, e.lng] as [number, number])
    if (coords.length === 0) {
      map.setView(CENTRO, 13)
      return
    }
    if (coords.length === 1) {
      map.setView(coords[0], 14)
      return
    }
    map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 15 })
  }, [equipos, puntos, map])
  return null
}

export default function MapaLeaflet({ equipos, seleccionado, puntosRecorrido, onSelect }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])

  if (!mounted) {
    return (
      <div className="h-[480px] bg-[#eef0f2] rounded-[10px] flex items-center justify-center text-[13px] text-[#9aa1ab]">
        Inicializando mapa…
      </div>
    )
  }

  return (
    <MapContainer center={CENTRO} zoom={13} className="h-[480px] w-full z-0" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AjustarVista equipos={equipos} puntos={puntosRecorrido} />
      {puntosRecorrido.length > 1 && (
        <Polyline positions={puntosRecorrido} pathOptions={{ color: '#E8650A', weight: 3, opacity: 0.85 }} />
      )}
      {equipos.map((e) => {
        const icon = iconoEquipo(e)
        const activo = seleccionado === e.id
        return (
          <Marker
            key={e.id}
            position={[e.lat, e.lng]}
            icon={icon}
            eventHandlers={{ click: () => onSelect(e.id) }}
            opacity={activo ? 1 : 0.85}
          >
            <Popup>
              <div className="text-[12px] leading-snug min-w-[160px]">
                <p className="font-bold">{e.nombre}</p>
                {e.numeroSerie && <p className="text-gray-500">{e.numeroSerie}</p>}
                <p>{e.cliente.nombre}</p>
                {e.direccion && <p className="text-gray-600 mt-1">{e.direccion}</p>}
                {e.mantenimientoVencido && (
                  <p className="text-red-600 font-semibold mt-1">Preventivo vencido</p>
                )}
                <button
                  type="button"
                  onClick={() => abrirGoogleMaps(googleMapsNavegar({
                    lat: e.lat,
                    lng: e.lng,
                    label: `${e.nombre} — ${e.cliente.nombre}`,
                  }))}
                  className="mt-2 text-[11px] font-bold text-[#4285F4] hover:underline"
                >
                  Ir con Google Maps →
                </button>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
