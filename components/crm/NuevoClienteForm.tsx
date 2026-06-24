'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { TIPO_CLIENTE, CONDICION_IVA } from '@/lib/form-options'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, parsearRespuestaApi } from '@/lib/errores'
import { validarEmailOpcional } from '@/lib/form-validation'
import {
  SucursalesEditor,
  sucursalDraftVacia,
  validarSucursalesDraft,
  type SucursalDraft,
} from '@/components/clientes/SucursalesEditor'

export function NuevoClienteForm() {
  const router = useRouter()
  const puedeCrear = useCan('clientes.create')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    tipo: 'OTRO',
    cuit: '',
    contacto: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    condicionIva: '',
  })
  const [sucursales, setSucursales] = useState<SucursalDraft[]>([sucursalDraftVacia()])

  function setF(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!puedeCrear) {
      toast.error('No tenés permiso para crear clientes')
      return
    }
    if (form.nombre.trim().length < 2) {
      toast.error('El nombre debe tener al menos 2 caracteres')
      return
    }

    const errEmail = validarEmailOpcional(form.email)
    if (errEmail) {
      toast.error(errEmail)
      return
    }

    const errSucursales = validarSucursalesDraft(sucursales)
    if (errSucursales) {
      toast.error(errSucursales)
      return
    }

    setLoading(true)
    try {
      const cliente = await parsearRespuestaApi<{ id: string; nombre: string }>(
        await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: form.nombre.trim(),
            tipo: form.tipo,
            cuit: form.cuit.trim() || undefined,
            contacto: form.contacto.trim() || undefined,
            email: form.email.trim() || undefined,
            telefono: form.telefono.trim() || undefined,
            direccion: form.direccion.trim() || undefined,
            ciudad: form.ciudad.trim() || undefined,
            condicionIva: form.condicionIva || undefined,
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
        }),
        'No se pudo crear el cliente',
      )
      toast.success(`Cliente ${cliente.nombre} creado`)
      router.push(`/crm/${cliente.id}`)
      router.refresh()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'No se pudo crear el cliente'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={guardar} className="max-w-3xl flex flex-col gap-4">
      <Link href="/crm" className="text-[12px] font-semibold text-[#6b7280] hover:text-[#E8650A] w-fit">
        ← Volver a clientes
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales y contacto</CardTitle>
        </CardHeader>
        <div className="px-5 pb-5 flex flex-col gap-3.5">
          <p className="text-[11.5px] text-[#9aa1ab] -mt-1">
            Razón social, CUIT y sede administrativa. Las ubicaciones donde se instalan equipos se cargan abajo como sucursales.
          </p>
          <Input
            label="Nombre / Razón social *"
            value={form.nombre}
            onChange={(e) => setF('nombre', e.target.value)}
            autoComplete="organization"
          />
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={(e) => setF('tipo', e.target.value)}
            options={TIPO_CLIENTE}
          />
          <Input
            label="CUIT"
            value={form.cuit}
            onChange={(e) => setF('cuit', e.target.value)}
            placeholder="30-12345678-9"
            autoComplete="off"
          />
          <Select
            label="Condición IVA"
            value={form.condicionIva}
            onChange={(e) => setF('condicionIva', e.target.value)}
            placeholder="Seleccionar…"
            options={[...CONDICION_IVA]}
          />
          <Input
            label="Persona de contacto"
            value={form.contacto}
            onChange={(e) => setF('contacto', e.target.value)}
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setF('email', e.target.value)}
            autoComplete="email"
          />
          <Input
            label="Teléfono"
            value={form.telefono}
            onChange={(e) => setF('telefono', e.target.value)}
            autoComplete="tel"
          />
          <Input
            label="Dirección fiscal / administrativa"
            value={form.direccion}
            onChange={(e) => setF('direccion', e.target.value)}
            placeholder="Oficina central, contaduría…"
            autoComplete="street-address"
          />
          <Input
            label="Ciudad (sede administrativa)"
            value={form.ciudad}
            onChange={(e) => setF('ciudad', e.target.value)}
            autoComplete="address-level2"
          />
        </div>
      </Card>

      <Card>
        <div className="px-5 py-5">
          <SucursalesEditor
            value={sucursales}
            onChange={setSucursales}
            tipoCliente={form.tipo}
          />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.push('/crm')} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          Crear cliente
        </Button>
      </div>
    </form>
  )
}
