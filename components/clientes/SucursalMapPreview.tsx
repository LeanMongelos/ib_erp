'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CENTRO: [number, number] = [-26.1849, -58.1731]

function crearPin() {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#E8650A;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 16],
  })
}

function CentrarMarcador({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 16)
  }, [lat, lng, map])
  return null
}

interface Props {
  lat: number
  lng: number
  onPositionChange?: (lat: number, lng: number) => void
  height?: number
}

export function SucursalMapPreview({ lat, lng, onPositionChange, height = 160 }: Props) {
  const [mounted, setMounted] = useState(false)
  const [pin, setPin] = useState<L.DivIcon | null>(null)

  useEffect(() => {
    setMounted(true)
    setPin(crearPin())
  }, [])

  if (!mounted || !pin) {
    return (
      <div
        className="bg-[#eef0f2] rounded-lg flex items-center justify-center text-[11px] text-[#9aa1ab]"
        style={{ height }}
      >
        Cargando mapa…
      </div>
    )
  }

  return (
    <MapContainer
      center={CENTRO}
      zoom={16}
      className="w-full rounded-lg z-0"
      style={{ height }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CentrarMarcador lat={lat} lng={lng} />
      <Marker
        position={[lat, lng]}
        icon={pin}
        draggable={!!onPositionChange}
        eventHandlers={
          onPositionChange
            ? {
                dragend: (e) => {
                  const pos = e.target.getLatLng()
                  onPositionChange(pos.lat, pos.lng)
                },
              }
            : undefined
        }
      />
    </MapContainer>
  )
}
