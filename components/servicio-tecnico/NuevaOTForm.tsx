'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
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

type ModoEquipo = 'ninguno' | 'cliente' | 'manual'

const PRIORIDADES = PRIORIDAD_OT

const equipoManualVacio = () => ({
  nombre: '',
  marca: '',
  modelo: '',
  numeroSerie: '',
  notasTecnicas: '',
})

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
  const [modoEquipo, setModoEquipo] = useState<ModoEquipo>(equipoInicialId ? 'cliente' : 'ninguno')
  const [equipoId, setEquipoId] = useState(equipoInicialId)
  const [equipoManual, setEquipoManual] = useState(equipoManualVacio())
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
    if (equipoInicialId) {
      setEquipoId(equipoInicialId)
      setModoEquipo('cliente')
    }
  }, [equipoInicialId])

  useEffect(() => {
    if (modoEquipo !== 'cliente') return
    if (!equipoId) return
    if (!equiposCliente.some((e) => e.id === equipoId)) setEquipoId('')
  }, [equipoId, equiposCliente, modoEquipo])

  function cambiarModoEquipo(modo: ModoEquipo) {
    setModoEquipo(modo)
    if (modo !== 'cliente') setEquipoId('')
    if (modo !== 'manual') setEquipoManual(equipoManualVacio())
  }

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
    if (modoEquipo === 'manual' && equipoManual.nombre.trim().length < 2) {
      toast.error('Indicá el nombre del equipo (mínimo 2 caracteres)')
      return
    }

    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        clienteId,
        tecnicoId: tecnicoId || null,
        descripcion: descripcion.trim(),
        prioridad,
        slaHoras,
        tipo,
      }

      if (modoEquipo === 'cliente' && equipoId) {
        payload.equipoId = equipoId
      } else if (modoEquipo === 'manual') {
        payload.equipoNuevo = {
          nombre: equipoManual.nombre.trim(),
          marca: equipoManual.marca.trim() || null,
          modelo: equipoManual.modelo.trim() || null,
          numeroSerie: equipoManual.numeroSerie.trim() || null,
          notasTecnicas: equipoManual.notasTecnicas.trim() || null,
        }
      } else {
        payload.equipoId = null
      }

      const ot = await parsearRespuestaApi<{ id: string; numero: string }>(
        await fetch('/api/ots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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

  const tabsEquipo: { value: ModoEquipo; label: string }[] = [
    { value: 'ninguno', label: 'Sin equipo' },
    { value: 'cliente', label: 'Del cliente' },
    { value: 'manual', label: 'Equipo externo sin stock' },
  ]

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

          <div className="flex flex-col gap-2">
            <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Equipo (opcional)</label>
            <div className="inline-flex rounded-[9px] border border-[#e4e7eb] p-0.5 bg-[#fafbfc] w-fit">
              {tabsEquipo.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  disabled={!clienteId && tab.value !== 'ninguno'}
                  onClick={() => cambiarModoEquipo(tab.value)}
                  className={`px-3 py-1.5 text-[12px] font-semibold rounded-[7px] transition-colors ${
                    modoEquipo === tab.value
                      ? 'bg-white text-[#E8650A] shadow-sm'
                      : 'text-[#6b7280] hover:text-[#3a4150]'
                  } disabled:opacity-40`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {modoEquipo === 'cliente' && (
              <Combobox
                value={equipoId}
                onChange={setEquipoId}
                options={equiposCliente.map((eq) => ({
                  value: eq.id,
                  label: eq.nombre,
                }))}
                placeholder={equiposCliente.length ? 'Seleccionar equipo del cliente…' : 'Este cliente no tiene equipos registrados'}
                disabled={!clienteId}
              />
            )}

            {modoEquipo === 'manual' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-[#eef0f2] rounded-[9px] p-3 bg-[#fafbfc]">
                <p className="sm:col-span-2 text-[11px] text-[#6b7280]">
                  Para equipos externos o no vendidos por la empresa. Se crea la ficha en el cliente y queda en la historia clínica.
                </p>
                <Input
                  label="Nombre del equipo *"
                  value={equipoManual.nombre}
                  onChange={(e) => setEquipoManual({ ...equipoManual, nombre: e.target.value })}
                  placeholder="Ej. Monitor multiparamétrico"
                />
                <Input
                  label="Marca"
                  value={equipoManual.marca}
                  onChange={(e) => setEquipoManual({ ...equipoManual, marca: e.target.value })}
                />
                <Input
                  label="Modelo"
                  value={equipoManual.modelo}
                  onChange={(e) => setEquipoManual({ ...equipoManual, modelo: e.target.value })}
                />
                <Input
                  label="N° serie"
                  value={equipoManual.numeroSerie}
                  onChange={(e) => setEquipoManual({ ...equipoManual, numeroSerie: e.target.value })}
                />
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[11.5px] font-semibold text-[#5b626d] uppercase">Notas técnicas</label>
                  <textarea
                    value={equipoManual.notasTecnicas}
                    onChange={(e) => setEquipoManual({ ...equipoManual, notasTecnicas: e.target.value })}
                    rows={2}
                    className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] resize-y"
                  />
                </div>
              </div>
            )}
          </div>

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
