'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { CheckCircle2, Loader2, MapPin, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { mensajeErrorDesconocido } from '@/lib/errores'

const SucursalMapPreview = dynamic(
  () => import('@/components/clientes/SucursalMapPreview').then((m) => m.SucursalMapPreview),
  {
    ssr: false,
    loading: () => (
      <div className="bg-[#eef0f2] rounded-lg flex items-center justify-center text-[11px] text-[#9aa1ab] min-h-[140px]">
        Cargando mapa…
      </div>
    ),
  },
)

export type GeoStatus = 'idle' | 'loading' | 'confirmed' | 'error'

export interface UbicacionLineaAlquilerValue {
  domicilio: string
  localidad: string
  provincia: string
  lat: number | null
  lng: number | null
  geoStatus: GeoStatus
  geoError: string | null
}

interface Props {
  value: UbicacionLineaAlquilerValue
  onChange: (patch: Partial<UbicacionLineaAlquilerValue>) => void
  compact?: boolean
}

async function geocodificarEnCliente(
  domicilio: string,
  localidad: string,
  provincia: string,
): Promise<{ lat: number; lng: number }> {
  const params = new URLSearchParams({
    domicilio: domicilio.trim(),
    localidad: localidad.trim() || 'Formosa',
    provincia: provincia.trim() || 'Formosa',
  })
  const res = await fetch(`/api/geocoding?${params}`, { credentials: 'include' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? 'Dirección no encontrada en el mapa')
  }
  return res.json()
}

export function LineaAlquilerUbicacionFields({ value, onChange, compact }: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  const domicilioOk = value.domicilio.trim().length >= 5
  const localidadOk = value.localidad.trim().length >= 2
  const listoParaGeocodificar = domicilioOk && localidadOk

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!listoParaGeocodificar) {
      if (value.geoStatus !== 'idle' || value.lat != null) {
        onChange({ lat: null, lng: null, geoStatus: 'idle', geoError: null })
      }
      return
    }

    if (value.geoStatus === 'confirmed' && value.lat != null && value.lng != null) {
      return
    }

    debounceRef.current = setTimeout(async () => {
      const reqId = ++requestIdRef.current
      onChange({ geoStatus: 'loading', geoError: null, lat: null, lng: null })

      try {
        const geo = await geocodificarEnCliente(value.domicilio, value.localidad, value.provincia)
        if (reqId !== requestIdRef.current) return
        onChange({
          lat: geo.lat,
          lng: geo.lng,
          geoStatus: 'confirmed',
          geoError: null,
        })
      } catch (e) {
        if (reqId !== requestIdRef.current) return
        onChange({
          lat: null,
          lng: null,
          geoStatus: 'error',
          geoError: mensajeErrorDesconocido(e, 'No se pudo validar la ubicación'),
        })
      }
    }, 700)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geocodificar al cambiar dirección
  }, [value.domicilio, value.localidad, value.provincia, value.geoStatus, listoParaGeocodificar])

  function patch(p: Partial<UbicacionLineaAlquilerValue>) {
    onChange(p)
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <p className="text-[11px] font-semibold text-[#3a4150] flex items-center gap-1">
        <MapPin size={13} className="text-[#E8650A]" />
        Ubicación en mapa (obligatoria) *
      </p>
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <div className={compact ? '' : 'sm:col-span-2'}>
          <label className="text-[12px] text-[#6b7280] mb-1 block">Domicilio instalación *</label>
          <Input
            value={value.domicilio}
            onChange={(e) =>
              patch({
                domicilio: e.target.value,
                lat: null,
                lng: null,
                geoStatus: 'idle',
                geoError: null,
              })
            }
            placeholder="Calle y número, ej. Av. 25 de Mayo 1234"
          />
        </div>
        <div>
          <label className="text-[12px] text-[#6b7280] mb-1 block">Localidad *</label>
          <Input
            value={value.localidad}
            onChange={(e) =>
              patch({
                localidad: e.target.value,
                lat: null,
                lng: null,
                geoStatus: 'idle',
                geoError: null,
              })
            }
            placeholder="Formosa"
          />
        </div>
        <div>
          <label className="text-[12px] text-[#6b7280] mb-1 block">Provincia</label>
          <Input
            value={value.provincia}
            onChange={(e) =>
              patch({
                provincia: e.target.value,
                lat: null,
                lng: null,
                geoStatus: 'idle',
                geoError: null,
              })
            }
            placeholder="Formosa"
          />
        </div>
      </div>

      {listoParaGeocodificar && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px]">
            {value.geoStatus === 'loading' && (
              <>
                <Loader2 size={13} className="text-[#E8650A] animate-spin" />
                <span className="text-[#6b7280]">Validando ubicación en mapa…</span>
              </>
            )}
            {value.geoStatus === 'confirmed' && value.lat != null && value.lng != null && (
              <>
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span className="text-emerald-700 font-medium">Ubicación confirmada — aparecerá en el mapa ST</span>
              </>
            )}
            {value.geoStatus === 'error' && (
              <>
                <AlertCircle size={13} className="text-red-600" />
                <span className="text-red-600">{value.geoError ?? 'Dirección no encontrada'}</span>
              </>
            )}
            {value.geoStatus === 'idle' && (
              <>
                <MapPin size={13} className="text-[#9aa1ab]" />
                <span className="text-[#9aa1ab]">Completá domicilio y localidad para ubicar en el mapa</span>
              </>
            )}
          </div>

          {value.geoStatus === 'confirmed' && value.lat != null && value.lng != null && (
            <div className="border border-[#eef0f2] rounded-lg overflow-hidden">
              <SucursalMapPreview
                lat={value.lat}
                lng={value.lng}
                onPositionChange={(lat, lng) =>
                  onChange({ lat, lng, geoStatus: 'confirmed', geoError: null })
                }
                height={compact ? 140 : 160}
              />
              <p className="text-[10px] text-[#9aa1ab] px-2 py-1.5 bg-[#fafbfc] border-t border-[#eef0f2]">
                Arrastrá el pin si la ubicación automática no es exacta.
              </p>
            </div>
          )}

          {value.geoStatus === 'error' && (
            <p className="text-[10px] text-[#6b7280]">
              Revisá la dirección o colocá el pin manualmente cuando aparezca el mapa tras una búsqueda exitosa.
              Sin pin confirmado no se puede guardar el contrato.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function ubicacionLineaAlquilerVacia(): UbicacionLineaAlquilerValue {
  return {
    domicilio: '',
    localidad: 'Formosa',
    provincia: 'Formosa',
    lat: null,
    lng: null,
    geoStatus: 'idle',
    geoError: null,
  }
}

export function ubicacionLineaAlquilerConfirmada(
  linea: {
    domicilio?: string | null
    localidad?: string | null
    provincia?: string | null
    lat?: number | null
    lng?: number | null
  },
): UbicacionLineaAlquilerValue {
  const tieneCoords = linea.lat != null && linea.lng != null
  return {
    domicilio: linea.domicilio ?? '',
    localidad: linea.localidad ?? 'Formosa',
    provincia: linea.provincia ?? 'Formosa',
    lat: linea.lat ?? null,
    lng: linea.lng ?? null,
    geoStatus: tieneCoords ? 'confirmed' : 'idle',
    geoError: null,
  }
}

export function ubicacionLineaAlquilerValida(value: UbicacionLineaAlquilerValue): boolean {
  return value.geoStatus === 'confirmed' && value.lat != null && value.lng != null
}
