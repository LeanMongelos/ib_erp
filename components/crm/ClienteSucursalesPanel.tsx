'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MapPin, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SucursalUbicacionFields,
  ubicacionSucursalVacia,
  type UbicacionSucursalValue,
} from '@/components/clientes/SucursalUbicacionFields'
import { construirDireccionCompleta } from '@/lib/geocoding'
import { mensajeErrorDesconocido } from '@/lib/errores'

interface Sucursal {
  id: string
  nombre: string
  direccion: string | null
  numero: string | null
  ciudad: string | null
  lat: number | null
  lng: number | null
}

interface Props {
  clienteId: string
  puedeEditar: boolean
}

function etiquetaDireccion(s: Sucursal): string {
  const calle = construirDireccionCompleta(s.direccion, s.numero)
  return [calle, s.ciudad].filter(Boolean).join(' · ') || 'Sin dirección'
}

export function ClienteSucursalesPanel({ clienteId, puedeEditar }: Props) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [ubicacion, setUbicacion] = useState<UbicacionSucursalValue>(ubicacionSucursalVacia())
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/sucursales`, { credentials: 'include' })
      if (!res.ok) throw new Error('No se pudieron cargar las sucursales')
      setSucursales(await res.json())
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar sucursales'))
    } finally {
      setLoading(false)
    }
  }, [clienteId])

  useEffect(() => { cargar() }, [cargar])

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { toast.error('Ingresá un nombre para la sucursal'); return }
    if (!ubicacion.direccion.trim()) { toast.error('Indicá la calle o dirección'); return }
    if (!ubicacion.numero.trim()) { toast.error('Indicá el número de calle'); return }
    if (!ubicacion.ciudad.trim()) { toast.error('Indicá la ciudad'); return }
    if (ubicacion.geoStatus === 'loading') { toast.error('Esperá a que termine la validación en el mapa'); return }
    if (ubicacion.lat == null || ubicacion.lng == null) {
      toast.error('Validá la ubicación en el mapa (calle + número + ciudad)')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/sucursales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          direccion: ubicacion.direccion.trim() || null,
          numero: ubicacion.numero.trim() || null,
          ciudad: ubicacion.ciudad.trim() || null,
          lat: ubicacion.lat,
          lng: ubicacion.lng,
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear la sucursal')
      toast.success('Sucursal agregada')
      setNombre('')
      setUbicacion(ubicacionSucursalVacia())
      cargar()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'Error al crear sucursal'))
    } finally {
      setSaving(false)
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Desactivar esta sucursal?')) return
    try {
      const res = await fetch(`/api/clientes/${clienteId}/sucursales/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('No se pudo eliminar')
      toast.success('Sucursal desactivada')
      cargar()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'Error al eliminar sucursal'))
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <MapPin size={16} className="text-[#E8650A]" />
        <h3 className="text-[13.5px] font-bold text-[#1f242c]">Sucursales / sedes de instalación</h3>
      </div>
      <p className="text-[11.5px] text-[#9aa1ab] mb-4 leading-relaxed">
        Ubicaciones donde se instalan equipos. Indicá calle y número para validar en el mapa;
        al facturar o registrar un equipo podés elegir la sucursal y aparece en el tracking.
      </p>

      {loading ? (
        <p className="text-[12px] text-[#9aa1ab]">Cargando sucursales…</p>
      ) : sucursales.length === 0 ? (
        <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
          Sin sucursales — agregá al menos una sede para asignar equipos e instalaciones en el mapa.
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {sucursales.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 p-3 bg-[#fafbfc] border border-[#eef0f2] rounded-lg">
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold text-[#1f242c]">{s.nombre}</p>
                <p className="text-[11.5px] text-[#6b7280] mt-0.5">{etiquetaDireccion(s)}</p>
                {s.lat != null && (
                  <p className="text-[10px] text-[#9aa1ab] mt-0.5 font-mono">{s.lat.toFixed(5)}, {s.lng?.toFixed(5)}</p>
                )}
              </div>
              {puedeEditar && (
                <button type="button" onClick={() => eliminar(s.id)} className="text-[#9aa1ab] hover:text-red-600 p-1">
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {puedeEditar && (
        <form onSubmit={agregar} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#eef0f2]">
          <Input label="Nombre sucursal *" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Hospital Las Lomitas, UTI, Sede central" />
          <Input
            label="Ciudad *"
            value={ubicacion.ciudad}
            onChange={(e) =>
              setUbicacion((u) => ({
                ...u,
                ciudad: e.target.value,
                lat: null,
                lng: null,
                geoStatus: 'idle',
                geoError: null,
              }))
            }
          />
          <div className="sm:col-span-2">
            <SucursalUbicacionFields
              compact
              value={ubicacion}
              onChange={(patch) => setUbicacion((u) => ({ ...u, ...patch }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              <Plus size={14} /> Agregar sucursal
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
