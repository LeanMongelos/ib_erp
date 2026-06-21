'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ClienteCombobox } from '@/components/clientes/ClienteCombobox'
import { PRIORIDAD_OT, SLA_HORAS } from '@/lib/form-options'
import { TIPOS_OT } from '@/lib/inventario-constants'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, parsearRespuestaApi } from '@/lib/errores'

interface Cliente {
  id: string
  nombre: string
}

interface Equipo {
  id: string
  nombre: string
  clienteId: string
  cliente?: { nombre: string }
}

interface Tecnico {
  id: string
  nombre: string
}

const PRIORIDADES = PRIORIDAD_OT

export function NuevaOTForm({
  clientes,
  equipos,
  tecnicos,
  clienteInicialId = '',
  equipoInicialId = '',
}: {
  clientes: Cliente[]
  equipos: Equipo[]
  tecnicos: Tecnico[]
  clienteInicialId?: string
  equipoInicialId?: string
}) {
  const router = useRouter()
  const puedeCrear = useCan('servicio.create')
  const [clienteId, setClienteId] = useState(clienteInicialId)
  const [equipoId, setEquipoId] = useState(equipoInicialId)
  const [tecnicoId, setTecnicoId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState<string>('CORRECTIVO')
  const [prioridad, setPrioridad] = useState<string>('NORMAL')
  const [slaHoras, setSlaHoras] = useState(48)
  const [loading, setLoading] = useState(false)

  const equiposCliente = useMemo(
    () => (clienteId ? equipos.filter((e) => e.clienteId === clienteId) : equipos),
    [clienteId, equipos],
  )

  useEffect(() => {
    if (clienteInicialId) setClienteId(clienteInicialId)
  }, [clienteInicialId])

  useEffect(() => {
    if (equipoInicialId) setEquipoId(equipoInicialId)
  }, [equipoInicialId])

  useEffect(() => {
    if (!equipoId) return
    if (!equiposCliente.some((e) => e.id === equipoId)) setEquipoId('')
  }, [equipoId, equiposCliente])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!puedeCrear) {
      toast.error('No tenés permisos para crear órdenes de trabajo')
      return
    }
    if (!clienteId) {
      toast.error('Seleccioná un cliente')
      return
    }
    if (descripcion.trim().length < 5) {
      toast.error('La descripción debe tener al menos 5 caracteres')
      return
    }

    setLoading(true)
    try {
      const ot = await parsearRespuestaApi<{ id: string; numero: string }>(
        await fetch('/api/ots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clienteId,
            equipoId: equipoId || null,
            tecnicoId: tecnicoId || null,
            descripcion: descripcion.trim(),
            prioridad,
            slaHoras,
            tipo,
          }),
        }),
        'No se pudo crear la orden de trabajo',
      )
      toast.success(`OT ${ot.numero} creada`)
      router.push(`/servicio-tecnico/${ot.id}`)
      router.refresh()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'No se pudo crear la orden de trabajo'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={guardar} className="max-w-2xl flex flex-col gap-4">
      <Link href="/servicio-tecnico" className="text-[12px] font-semibold text-[#6b7280] hover:text-[#E8650A] w-fit">
        ← Volver a órdenes de trabajo
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la OT</CardTitle>
        </CardHeader>
        <div className="px-5 pb-5 flex flex-col gap-3.5">
          <ClienteCombobox
            value={clienteId}
            onChange={setClienteId}
            initialOptions={clientes}
            label="Cliente *"
            placeholder="Seleccionar…"
          />

          <Select
            label="Equipo (opcional)"
            value={equipoId}
            onChange={(e) => setEquipoId(e.target.value)}
            disabled={!clienteId}
            placeholder="Sin equipo específico"
            options={equiposCliente.map((eq) => ({
              value: eq.id,
              label: `${eq.nombre}${eq.cliente?.nombre ? ` — ${eq.cliente.nombre}` : ''}`,
            }))}
          />

          <Select
            label="Tipo de OT"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            options={[...TIPOS_OT]}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Descripción del problema *</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              placeholder="Ej.: Monitor de signos vitales no enciende, código de error E-12 en pantalla…"
              autoComplete="off"
              className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px] resize-y min-h-[96px]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Select
              label="Prioridad"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              options={[...PRIORIDADES]}
            />

            <Select
              label="SLA (horas)"
              value={String(slaHoras)}
              onChange={(e) => setSlaHoras(Number(e.target.value))}
              options={SLA_HORAS}
            />

            <Select
              label="Técnico (opcional)"
              value={tecnicoId}
              onChange={(e) => setTecnicoId(e.target.value)}
              placeholder="Sin asignar"
              options={tecnicos.map((t) => ({ value: t.id, label: t.nombre }))}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/servicio-tecnico">
          <Button type="button" variant="secondary" disabled={loading}>Cancelar</Button>
        </Link>
        <Button type="submit" variant="primary" loading={loading} disabled={!puedeCrear}>
          Crear OT
        </Button>
      </div>
    </form>
  )
}
