'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SucursalUbicacionFields,
  ubicacionSucursalVacia,
  type UbicacionSucursalValue,
} from '@/components/clientes/SucursalUbicacionFields'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

export interface SucursalOption {
  id: string
  nombre: string
  direccion?: string | null
  numero?: string | null
  ciudad?: string | null
}

interface Props {
  open: boolean
  clienteId: string
  clienteNombre?: string
  onClose: () => void
  onCreated: (sucursal: SucursalOption) => void
}

export function SucursalRapidaModal({
  open,
  clienteId,
  clienteNombre,
  onClose,
  onCreated,
}: Props) {
  const [nombre, setNombre] = useState('')
  const [ubicacion, setUbicacion] = useState<UbicacionSucursalValue>(ubicacionSucursalVacia())
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) {
      setNombre('')
      setUbicacion(ubicacionSucursalVacia())
    }
  }, [open])

  if (!open) return null

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) {
      toast.error('Indicá un nombre para la sucursal')
      return
    }
    if (!ubicacion.direccion.trim()) {
      toast.error('Indicá la calle o dirección')
      return
    }
    if (!ubicacion.numero.trim()) {
      toast.error('Indicá el número de calle')
      return
    }
    if (!ubicacion.ciudad.trim()) {
      toast.error('Indicá la ciudad')
      return
    }
    if (ubicacion.geoStatus === 'loading') {
      toast.error('Esperá a que termine la validación en el mapa')
      return
    }
    if (ubicacion.lat == null || ubicacion.lng == null) {
      toast.error('Validá la ubicación en el mapa (calle + número + ciudad)')
      return
    }

    setGuardando(true)
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo crear la sucursal'))
      toast.success(`Sucursal «${data.nombre}» creada`)
      onCreated({
        id: data.id,
        nombre: data.nombre,
        direccion: data.direccion,
        numero: data.numero,
        ciudad: data.ciudad,
      })
      onClose()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'Error al crear sucursal'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
      data-modal-overlay
    >
      <form
        onSubmit={guardar}
        className="bg-white rounded-[12px] w-full max-w-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4e7eb] shrink-0">
          <div>
            <h3 className="text-[15px] font-bold text-[#1f242c]">Nueva sucursal de instalación</h3>
            {clienteNombre && (
              <p className="text-[12px] text-[#6b7280] mt-0.5">Cliente: {clienteNombre}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="text-[#9aa1ab] hover:text-[#3a4150] p-1 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <p className="text-[11.5px] text-[#9aa1ab] leading-relaxed">
            La sucursal queda guardada en la ficha del cliente y podés usarla para ubicar equipos en el mapa de servicio técnico.
          </p>
          <Input
            label="Nombre de la sucursal *"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Hospital Las Lomitas, UTI central"
            autoFocus
          />
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
          <SucursalUbicacionFields
            compact
            value={ubicacion}
            onChange={(patch) => setUbicacion((u) => ({ ...u, ...patch }))}
          />
        </div>

        <div className="px-5 py-3 border-t border-[#e4e7eb] flex justify-end gap-2 shrink-0">
          <Button type="button" variant="secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" loading={guardando}>
            Crear y usar
          </Button>
        </div>
      </form>
    </div>
  )
}
