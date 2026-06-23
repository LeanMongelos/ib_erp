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

export interface UbicacionSucursalValue {
  direccion: string
  numero: string
  ciudad: string
  lat: number | null
  lng: number | null
  geoStatus: GeoStatus
  geoError: string | null
}

interface Props {
  value: UbicacionSucursalValue
  onChange: (patch: Partial<UbicacionSucursalValue>) => void
  compact?: boolean
}

async function geocodificarEnCliente(
  direccion: string,
  numero: string,
  ciudad: string,
): Promise<{ lat: number; lng: number }> {
  const params = new URLSearchParams({
    direccion: direccion.trim(),
    numero: numero.trim(),
    ciudad: ciudad.trim() || 'Formosa',
  })
  const res = await fetch(`/api/geocoding?${params}`, { credentials: 'include' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? 'Dirección no encontrada en el mapa')
  }
  return res.json()
}

export function SucursalUbicacionFields({ value, onChange, compact }: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  const calleOk = value.direccion.trim().length >= 2
  const numeroOk = value.numero.trim().length >= 1
  const ciudadOk = value.ciudad.trim().length >= 1
  const listoParaGeocodificar = calleOk && numeroOk && ciudadOk

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!listoParaGeocodificar) {
      if (value.geoStatus !== 'idle' || value.lat != null) {
        onChange({ lat: null, lng: null, geoStatus: 'idle', geoError: null })
      }
      return
    }

    debounceRef.current = setTimeout(async () => {
      const reqId = ++requestIdRef.current
      onChange({ geoStatus: 'loading', geoError: null, lat: null, lng: null })

      try {
        const geo = await geocodificarEnCliente(value.direccion, value.numero, value.ciudad)
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
  }, [value.direccion, value.numero, value.ciudad, listoParaGeocodificar])

  function actualizarCampo(patch: Partial<UbicacionSucursalValue>) {
    onChange(patch)
  }

  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <Input
          label="Calle / dirección *"
          className={compact ? '' : 'sm:col-span-2'}
          value={value.direccion}
          onChange={(e) =>
            actualizarCampo({
              direccion: e.target.value,
              lat: null,
              lng: null,
              geoStatus: 'idle',
              geoError: null,
            })
          }
          placeholder="Ej. Av. 25 de Mayo"
        />
        <Input
          label="Número *"
          value={value.numero}
          onChange={(e) =>
            actualizarCampo({
              numero: e.target.value,
              lat: null,
              lng: null,
              geoStatus: 'idle',
              geoError: null,
            })
          }
          placeholder="Ej. 1234"
        />
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
                <span className="text-emerald-700 font-medium">Ubicación confirmada en mapa</span>
                <span className="text-[#9aa1ab] font-mono ml-1">
                  ({value.lat.toFixed(5)}, {value.lng.toFixed(5)})
                </span>
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
                <span className="text-[#9aa1ab]">Completá calle, número y ciudad para validar</span>
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
                Arrastrá el pin si necesitás ajustar la ubicación exacta.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ubicacionSucursalVacia(): UbicacionSucursalValue {
  return {
    direccion: '',
    numero: '',
    ciudad: 'Formosa',
    lat: null,
    lng: null,
    geoStatus: 'idle',
    geoError: null,
  }
}
