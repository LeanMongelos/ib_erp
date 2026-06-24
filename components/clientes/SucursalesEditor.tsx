'use client'

import { MapPin, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SucursalUbicacionFields,
  ubicacionSucursalVacia,
  type GeoStatus,
} from '@/components/clientes/SucursalUbicacionFields'
import type { SucursalInput } from '@/lib/clientes/crear-cliente'
import { validarListaSucursales } from '@/lib/clientes/validar-sucursales'

export type SucursalDraft = SucursalInput & {
  _key: string
  geoStatus: GeoStatus
  geoError: string | null
}

export function sucursalDraftVacia(): SucursalDraft {
  const ubicacion = ubicacionSucursalVacia()
  return {
    _key: crypto.randomUUID(),
    nombre: '',
    direccion: ubicacion.direccion,
    numero: ubicacion.numero,
    ciudad: ubicacion.ciudad,
    lat: ubicacion.lat,
    lng: ubicacion.lng,
    notas: null,
    geoStatus: ubicacion.geoStatus,
    geoError: ubicacion.geoError,
  }
}

interface Props {
  value: SucursalDraft[]
  onChange: (value: SucursalDraft[]) => void
  tipoCliente?: string
  compact?: boolean
}

function hintPorTipo(tipo?: string): string {
  if (tipo === 'ORGANISMO_PUBLICO') {
    return 'Organismos como el Ministerio de Salud suelen instalar equipos en toda la provincia. Cargá cada hospital, centro de salud o delegación como sucursal (ej. Hospital Las Lomitas, Hospital Clorinda, Dirección provincial).'
  }
  return 'Cada sucursal es una ubicación donde pueden instalarse equipos. Indicá calle y número para validar la ubicación en el mapa — al facturar o dar de alta un equipo aparece en el tracking.'
}

export function SucursalesEditor({ value, onChange, tipoCliente, compact }: Props) {
  function actualizar(index: number, patch: Partial<SucursalDraft>) {
    onChange(value.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function agregar() {
    onChange([...value, sucursalDraftVacia()])
  }

  function quitar(index: number) {
    if (value.length <= 1) return
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={16} className="text-[#E8650A]" />
          <h3 className="text-[13.5px] font-bold text-[#1f242c]">
            Sucursales / sedes de instalación *
          </h3>
        </div>
        <p className="text-[11.5px] text-[#9aa1ab] leading-relaxed">{hintPorTipo(tipoCliente)}</p>
      </div>

      <div className="space-y-3">
        {value.map((s, i) => (
          <div
            key={s._key}
            className="p-3.5 bg-[#fafbfc] border border-[#eef0f2] rounded-lg space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#9aa1ab]">
                Sucursal {i + 1}
              </span>
              {value.length > 1 && (
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  className="text-[#9aa1ab] hover:text-red-600 p-1"
                  title="Quitar sucursal"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <Input
                label="Nombre *"
                value={s.nombre}
                onChange={(e) => actualizar(i, { nombre: e.target.value })}
                placeholder={
                  tipoCliente === 'ORGANISMO_PUBLICO'
                    ? 'Ej. Hospital Las Lomitas'
                    : 'Ej. Sede central, UTI, Filial norte'
                }
              />
              <Input
                label="Ciudad *"
                value={s.ciudad ?? ''}
                onChange={(e) =>
                  actualizar(i, {
                    ciudad: e.target.value,
                    lat: null,
                    lng: null,
                    geoStatus: 'idle',
                    geoError: null,
                  })
                }
              />
            </div>
            <SucursalUbicacionFields
              compact={compact}
              value={{
                direccion: s.direccion ?? '',
                numero: s.numero ?? '',
                ciudad: s.ciudad ?? 'Formosa',
                lat: s.lat ?? null,
                lng: s.lng ?? null,
                geoStatus: s.geoStatus,
                geoError: s.geoError,
              }}
              onChange={(patch) => actualizar(i, patch)}
            />
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" size="sm" onClick={agregar}>
        <Plus size={14} /> Agregar otra sucursal
      </Button>
    </div>
  )
}

export function validarSucursalesDraft(sucursales: SucursalDraft[]): string | null {
  return validarListaSucursales(sucursales, { exigirAlMenosUna: true })
}
