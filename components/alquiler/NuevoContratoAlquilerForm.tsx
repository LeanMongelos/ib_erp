'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import {
  LineaAlquilerUbicacionFields,
  ubicacionLineaAlquilerValida,
  ubicacionLineaAlquilerVacia,
  type UbicacionLineaAlquilerValue,
} from '@/components/alquiler/LineaAlquilerUbicacionFields'

interface ClienteOption {
  id: string
  nombre: string
  cuit: string | null
}

interface UnidadOption {
  id: string
  numeroSerie: string | null
  inventario: { nombre: string; marca: string | null; modelo: string | null }
}

interface LineaForm {
  inventarioUnidadId: string
  unidadLabel: string
  montoMensual: string
  beneficiarioNombre: string
  beneficiarioDocumento: string
  beneficiarioTelefono: string
  ubicacion: UbicacionLineaAlquilerValue
}

const lineaVacia = (): LineaForm => ({
  inventarioUnidadId: '',
  unidadLabel: '',
  montoMensual: '',
  beneficiarioNombre: '',
  beneficiarioDocumento: '',
  beneficiarioTelefono: '',
  ubicacion: ubicacionLineaAlquilerVacia(),
})

export function NuevoContratoAlquilerForm({ clientes }: { clientes: ClienteOption[] }) {
  const router = useRouter()
  const [clienteId, setClienteId] = useState('')
  const [diaFacturacion, setDiaFacturacion] = useState('1')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<LineaForm[]>([lineaVacia()])
  const [busquedaUnidad, setBusquedaUnidad] = useState<Record<number, string>>({})
  const [opcionesUnidad, setOpcionesUnidad] = useState<Record<number, UnidadOption[]>>({})
  const [guardando, setGuardando] = useState(false)

  async function buscarUnidades(idx: number, q: string) {
    setBusquedaUnidad((prev) => ({ ...prev, [idx]: q }))
    if (q.length < 2) {
      setOpcionesUnidad((prev) => ({ ...prev, [idx]: [] }))
      return
    }
    try {
      const res = await fetch(`/api/alquiler/unidades-disponibles?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al buscar unidades'))
      const data = await res.json()
      setOpcionesUnidad((prev) => ({ ...prev, [idx]: data }))
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al buscar unidades'))
    }
  }

  function seleccionarUnidad(idx: number, u: UnidadOption) {
    const label = `${u.inventario.nombre}${u.numeroSerie ? ` · ${u.numeroSerie}` : ''}`
    setLineas((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, inventarioUnidadId: u.id, unidadLabel: label } : l,
      ),
    )
    setOpcionesUnidad((prev) => ({ ...prev, [idx]: [] }))
    setBusquedaUnidad((prev) => ({ ...prev, [idx]: label }))
  }

  function actualizarUbicacion(idx: number, patch: Partial<UbicacionLineaAlquilerValue>) {
    setLineas((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, ubicacion: { ...l.ubicacion, ...patch } } : l,
      ),
    )
  }

  async function guardar() {
    if (!clienteId) {
      toast.error('Seleccioná el cliente pagador')
      return
    }
    const lineasValidas = lineas.filter((l) => l.inventarioUnidadId && Number(l.montoMensual) > 0)
    if (lineasValidas.length === 0) {
      toast.error('Agregá al menos una línea con unidad y monto mensual')
      return
    }

    for (let i = 0; i < lineasValidas.length; i++) {
      if (!ubicacionLineaAlquilerValida(lineasValidas[i]!.ubicacion)) {
        toast.error(`Línea ${i + 1}: confirmá la ubicación en el mapa (pin verde)`)
        return
      }
    }

    setGuardando(true)
    try {
      const res = await fetch('/api/alquiler/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          diaFacturacion: Number(diaFacturacion) || 1,
          observaciones: observaciones || null,
          lineas: lineasValidas.map((l) => ({
            inventarioUnidadId: l.inventarioUnidadId,
            montoMensual: Number(l.montoMensual),
            beneficiarioNombre: l.beneficiarioNombre || null,
            beneficiarioDocumento: l.beneficiarioDocumento || null,
            beneficiarioTelefono: l.beneficiarioTelefono || null,
            domicilio: l.ubicacion.domicilio.trim(),
            localidad: l.ubicacion.localidad.trim(),
            provincia: l.ubicacion.provincia.trim() || 'Formosa',
            lat: l.ubicacion.lat,
            lng: l.ubicacion.lng,
          })),
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo crear el contrato'))
      const contrato = await res.json()
      toast.success(`Contrato ${contrato.numero} creado`)
      router.push(`/alquiler/contratos/${contrato.id}`)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al crear contrato'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <Card>
        <h2 className="text-[14px] font-bold text-[#1f242c] mb-4">Datos del contrato</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] text-[#6b7280] mb-1 block">Cliente pagador *</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] bg-white"
            >
              <option value="">Seleccionar…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.cuit ? ` (${c.cuit})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] text-[#6b7280] mb-1 block">Día de facturación (1–28)</label>
            <Input
              type="number"
              min={1}
              max={28}
              value={diaFacturacion}
              onChange={(e) => setDiaFacturacion(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[12px] text-[#6b7280] mb-1 block">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="w-full border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] bg-white"
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-bold text-[#1f242c]">Equipos y beneficiarios</h2>
          <Button variant="outline" size="sm" onClick={() => setLineas((p) => [...p, lineaVacia()])}>
            <Plus size={14} /> Agregar línea
          </Button>
        </div>

        <div className="space-y-4">
          {lineas.map((linea, idx) => (
            <div key={idx} className="border border-[#eef0f2] rounded-[10px] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-[#3a4150]">Línea {idx + 1}</p>
                {lineas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLineas((p) => p.filter((_, i) => i !== idx))}
                    className="text-[#9aa1ab] hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <label className="text-[12px] text-[#6b7280] mb-1 block">Unidad serializada *</label>
                  <Input
                    value={busquedaUnidad[idx] ?? linea.unidadLabel}
                    onChange={(e) => buscarUnidades(idx, e.target.value)}
                    placeholder="Buscar por serie o producto…"
                  />
                  {(opcionesUnidad[idx]?.length ?? 0) > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-[#e4e7eb] rounded-[9px] shadow-lg max-h-40 overflow-y-auto">
                      {opcionesUnidad[idx]!.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#f3f4f6]"
                          onClick={() => seleccionarUnidad(idx, u)}
                        >
                          {u.inventario.nombre}
                          {u.numeroSerie && <span className="text-[#9aa1ab]"> · {u.numeroSerie}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[12px] text-[#6b7280] mb-1 block">Monto mensual (ARS) *</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={linea.montoMensual}
                    onChange={(e) =>
                      setLineas((p) => p.map((l, i) => (i === idx ? { ...l, montoMensual: e.target.value } : l)))
                    }
                  />
                </div>
                <div>
                  <label className="text-[12px] text-[#6b7280] mb-1 block">Beneficiario (paciente)</label>
                  <Input
                    value={linea.beneficiarioNombre}
                    onChange={(e) =>
                      setLineas((p) => p.map((l, i) => (i === idx ? { ...l, beneficiarioNombre: e.target.value } : l)))
                    }
                  />
                </div>
                <div>
                  <label className="text-[12px] text-[#6b7280] mb-1 block">Documento</label>
                  <Input
                    value={linea.beneficiarioDocumento}
                    onChange={(e) =>
                      setLineas((p) => p.map((l, i) => (i === idx ? { ...l, beneficiarioDocumento: e.target.value } : l)))
                    }
                  />
                </div>
                <div>
                  <label className="text-[12px] text-[#6b7280] mb-1 block">Teléfono beneficiario</label>
                  <Input
                    telefono
                    value={linea.beneficiarioTelefono}
                    onChange={(e) =>
                      setLineas((p) => p.map((l, i) => (i === idx ? { ...l, beneficiarioTelefono: e.target.value } : l)))
                    }
                  />
                </div>
                <LineaAlquilerUbicacionFields
                  value={linea.ubicacion}
                  onChange={(patch) => actualizarUbicacion(idx, patch)}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button variant="primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Crear contrato (borrador)'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/alquiler')}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
