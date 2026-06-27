'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ClienteCombobox } from '@/components/clientes/ClienteCombobox'
import {
  SucursalesEditor,
  sucursalDraftVacia,
  validarSucursalesDraft,
  type SucursalDraft,
} from '@/components/clientes/SucursalesEditor'
import { TIPO_CLIENTE } from '@/lib/form-options'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'
import { useCan } from '@/components/auth/useCan'

export interface ProspectoPrefill {
  nombre: string
  contacto?: string
  email?: string
  telefono?: string
}

interface Props {
  open: boolean
  prefill: ProspectoPrefill
  onClose: () => void
  onVinculado: (cliente: { id: string; nombre: string }) => void
}

export function parseProspectoDesdeConversacion(
  contactoNombre: string,
  contactoHandle: string,
): ProspectoPrefill {
  const handle = contactoHandle.trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle)
  const isPhone = /^\+?[\d\s()-]{8,}$/.test(handle.replace(/\s/g, ''))
  return {
    nombre: contactoNombre.trim(),
    contacto: contactoNombre.trim(),
    email: isEmail ? handle : '',
    telefono: isPhone ? handle : '',
  }
}

export function ClienteProspectoModal({ open, prefill, onClose, onVinculado }: Props) {
  const puedeCrear = useCan('clientes.create')
  const [modo, setModo] = useState<'crear' | 'vincular'>('crear')
  const [guardando, setGuardando] = useState(false)
  const [clienteExistenteId, setClienteExistenteId] = useState('')
  const [form, setForm] = useState({
    nombre: '',
    tipo: 'OTRO',
    contacto: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: '',
  })
  const [sucursales, setSucursales] = useState<SucursalDraft[]>([sucursalDraftVacia()])

  useEffect(() => {
    if (open) {
      setModo('crear')
      setClienteExistenteId('')
      setForm({
        nombre: prefill.nombre,
        tipo: 'OTRO',
        contacto: prefill.contacto ?? prefill.nombre,
        email: prefill.email ?? '',
        telefono: prefill.telefono ?? '',
        direccion: '',
        ciudad: '',
      })
      setSucursales([sucursalDraftVacia()])
    }
  }, [open, prefill])

  if (!open) return null

  function setF(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function vincularExistente() {
    if (!clienteExistenteId) {
      toast.error('Seleccioná un cliente')
      return
    }
    setGuardando(true)
    try {
      const res = await fetch(`/api/clientes/${clienteExistenteId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'Cliente no encontrado'))
      onVinculado({ id: data.id, nombre: data.nombre })
      onClose()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo vincular el cliente'))
    } finally {
      setGuardando(false)
    }
  }

  async function crearYVincular() {
    if (!puedeCrear) {
      toast.error('No tenés permiso para crear clientes')
      return
    }
    if (form.nombre.trim().length < 2) {
      toast.error('El nombre debe tener al menos 2 caracteres')
      return
    }
    const errSucursales = validarSucursalesDraft(sucursales)
    if (errSucursales) {
      toast.error(errSucursales)
      return
    }
    setGuardando(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          contacto: form.contacto.trim() || undefined,
          email: form.email.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          direccion: form.direccion.trim() || undefined,
          ciudad: form.ciudad.trim() || undefined,
          sucursales: sucursales.map((s) => ({
            nombre: s.nombre.trim(),
            direccion: s.direccion?.trim() || null,
            numero: s.numero?.trim() || null,
            ciudad: s.ciudad?.trim() || null,
            lat: s.lat ?? null,
            lng: s.lng ?? null,
            notas: s.notas?.trim() || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo crear el cliente'))
      toast.success('Cliente creado')
      onVinculado({ id: data.id, nombre: data.nombre })
      onClose()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo crear el cliente'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
      data-modal-overlay
    >
      <div className="bg-white rounded-[12px] w-full max-w-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4e7eb]">
          <div>
            <h3 className="text-[15px] font-bold text-[#1f242c]">Agregar como cliente</h3>
            <p className="text-[12px] text-[#6b7280] mt-0.5">Prospecto: {prefill.nombre}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#9aa1ab] hover:text-[#3a4150] p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-3 flex gap-2 border-b border-[#f0f1f4]">
          {(['crear', 'vincular'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`text-[12px] font-bold pb-2 border-b-2 transition-colors ${
                modo === m
                  ? 'border-[#E8650A] text-[#E8650A]'
                  : 'border-transparent text-[#6b7280] hover:text-[#3a4150]'
              }`}
            >
              {m === 'crear' ? 'Cliente nuevo' : 'Vincular existente'}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
          {modo === 'vincular' ? (
            <ClienteCombobox
              label="Buscar cliente del ERP"
              value={clienteExistenteId}
              onChange={(id) => setClienteExistenteId(id)}
              placeholder="Nombre, ciudad o contacto…"
            />
          ) : (
            <>
              <Input label="Nombre / Razón social *" value={form.nombre} onChange={(e) => setF('nombre', e.target.value)} />
              <Select
                label="Tipo"
                value={form.tipo}
                onChange={(e) => setF('tipo', e.target.value)}
                options={TIPO_CLIENTE}
              />
              <Input label="Persona de contacto" value={form.contacto} onChange={(e) => setF('contacto', e.target.value)} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} />
              <Input label="Teléfono" value={form.telefono} onChange={(e) => setF('telefono', e.target.value)} />
              <Input
                label="Dirección fiscal (opcional)"
                value={form.direccion}
                onChange={(e) => setF('direccion', e.target.value)}
                placeholder="Oficina central…"
              />
              <Input
                label="Ciudad administrativa (opcional)"
                value={form.ciudad}
                onChange={(e) => setF('ciudad', e.target.value)}
              />
              <div className="pt-2 border-t border-[#eef0f2]">
                <SucursalesEditor
                  value={sucursales}
                  onChange={setSucursales}
                  tipoCliente={form.tipo}
                  compact
                />
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#e4e7eb] flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            type="button"
            loading={guardando}
            onClick={modo === 'vincular' ? vincularExistente : crearYVincular}
          >
            {modo === 'vincular' ? 'Vincular' : 'Crear y vincular'}
          </Button>
        </div>
      </div>
    </div>
  )
}
