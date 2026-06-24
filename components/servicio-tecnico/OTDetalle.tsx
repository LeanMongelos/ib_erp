'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronDown } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeEstadoOT, BadgePrioridad } from '@/components/ui/badge'
import { SLAProgressBar } from './SLAProgressBar'
import { OTTimeline } from './OTTimeline'
import { OTFlujoComercial } from './OTFlujoComercial'
import { formatMonto } from '@/lib/utils'
import type { OrdenTrabajo } from '@/types'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { InventarioPicker, type InventarioOption } from '@/components/inventario/InventarioPicker'
import { validarRepuestosOTCliente } from '@/lib/ots/repuestos-ot-client'
import { transicionesOTPermitidas, validarTransicionOT } from '@/lib/ots/transiciones-client'
import type { EstadoOT } from '@/types'

const ESTADO_LABEL: Record<EstadoOT, string> = {
  ABIERTA: 'Abierta',
  EN_PROCESO: 'En proceso',
  CERRADA: 'Cerrada',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
}

export function OTDetalle({ ot }: { ot: any }) {
  const router = useRouter()
  const [diagnostico, setDiagnostico] = useState(ot.diagnostico ?? '')
  const [repuestos, setRepuestos] = useState<any[]>(ot.repuestos ?? [])
  const [loading, setLoading] = useState(false)
  const [estadoMenu, setEstadoMenu] = useState(false)

  const totalRepuestos = repuestos.reduce((acc, r) => acc + r.cantidad * r.precioUnit, 0)

  async function cambiarEstado(nuevoEstado: string) {
    setEstadoMenu(false)
    const err = validarTransicionOT(ot.estado as EstadoOT, nuevoEstado as EstadoOT)
    if (err) {
      toast.error(err)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/ots/${ot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado, nota: `Estado cambiado a ${nuevoEstado}` }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo actualizar el estado'))
      toast.success('Estado actualizado correctamente')
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo actualizar el estado'))
    } finally {
      setLoading(false)
    }
  }

  async function guardarDiagnostico() {
    setLoading(true)
    try {
      const res = await fetch(`/api/ots/${ot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnostico }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo guardar el diagnóstico'))
      toast.success('Diagnóstico guardado')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar el diagnóstico'))
    } finally {
      setLoading(false)
    }
  }

  function agregarRepuesto() {
    setRepuestos([...repuestos, { id: `new-${Date.now()}`, descripcion: '', cantidad: 1, precioUnit: 0, otId: ot.id }])
  }

  function eliminarRepuesto(idx: number) {
    setRepuestos(repuestos.filter((_, i) => i !== idx))
  }

  async function guardarRepuestos() {
    const validos = repuestos.filter((r) => r.descripcion?.trim())
    const errRep = validarRepuestosOTCliente(validos)
    if (errRep) {
      toast.error(errRep)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/ots/${ot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repuestos: validos.map((r) => ({
            descripcion: r.descripcion.trim(),
            cantidad: Number(r.cantidad) || 1,
            precioUnit: Number(r.precioUnit) || 0,
            inventarioId: r.inventarioId ?? null,
          })),
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron guardar los repuestos'))
      toast.success('Repuestos guardados')
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudieron guardar los repuestos'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <OTFlujoComercial
        otId={ot.id}
        otNumero={ot.numero}
        otEstado={ot.estado}
        presupuestos={ot.presupuestos ?? []}
        factura={ot.factura}
      />
      {/* Header OT */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-[19px] font-extrabold text-[#16181d] tracking-tight">{ot.numero}</h2>
              <BadgeEstadoOT estado={ot.estado} />
              <BadgePrioridad prioridad={ot.prioridad} />
            </div>
            <p className="text-[13px] text-[#6b7280] mt-1.5">
              <span className="font-bold text-[#3a4150]">{ot.cliente?.nombre}</span>
              {ot.equipo && (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => router.push(`/servicio-tecnico/equipos/${ot.equipo.id}`)}
                    className="text-[#E8650A] font-semibold hover:underline"
                  >
                    {ot.equipo.nombre}
                  </button>
                </>
              )}
              {ot.equipo?.modelo && ` · ${ot.equipo.modelo}`}
              {ot.equipo?.numeroSerie && ` · N° serie ${ot.equipo.numeroSerie}`}
            </p>
            {ot.equipo?.id && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => router.push(`/servicio-tecnico/equipos/${ot.equipo.id}`)}
              >
                Ver historia clínica del equipo
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Dropdown cambiar estado */}
            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setEstadoMenu(!estadoMenu)}>
                Cambiar estado <ChevronDown size={14} />
              </Button>
              {estadoMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#e9ebef] rounded-[10px] shadow-lg py-1 z-50">
                  {transicionesOTPermitidas(ot.estado as EstadoOT).map((value) => (
                    <button
                      key={value}
                      onClick={() => cambiarEstado(value)}
                      className="w-full text-left px-4 py-2.5 text-[12.5px] font-medium text-[#3a4150] hover:bg-gray-50"
                    >
                      {ESTADO_LABEL[value]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="dark"
              size="sm"
              onClick={() => cambiarEstado('CERRADA')}
              disabled={
                loading ||
                ot.estado === 'CERRADA' ||
                !transicionesOTPermitidas(ot.estado as EstadoOT).includes('CERRADA')
              }
            >
              Cerrar OT
            </Button>
          </div>
        </div>

        <SLAProgressBar
          fechaApertura={ot.fechaApertura}
          slaVence={ot.slaVence}
          estado={ot.estado}
        />
      </Card>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.85fr 1fr' }}>
        {/* Panel izquierdo */}
        <div className="flex flex-col gap-3.5">
          {/* Descripción + Diagnóstico */}
          <div className="grid grid-cols-2 gap-3.5">
            <Card>
              <p className="text-[11px] font-bold text-[#8a909a] tracking-[0.6px] uppercase mb-2">Descripción del problema</p>
              <p className="text-[12.5px] text-[#3a4150] leading-relaxed">{ot.descripcion}</p>
            </Card>
            <Card className="flex flex-col">
              <p className="text-[11px] font-bold text-[#8a909a] tracking-[0.6px] uppercase mb-2">Diagnóstico</p>
              <textarea
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                onBlur={guardarDiagnostico}
                rows={4}
                placeholder="Ingresar diagnóstico técnico…"
                className="flex-1 text-[12.5px] text-[#3a4150] leading-relaxed bg-transparent border-none outline-none resize-none placeholder:text-gray-400"
              />
            </Card>
          </div>

          {/* Repuestos */}
          <Card padding={false} className="overflow-hidden">
            <CardHeader className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <CardTitle>Repuestos utilizados</CardTitle>
                <div className="flex items-center gap-3">
                  <button
                    onClick={agregarRepuesto}
                    className="text-[11.5px] text-[#E8650A] font-bold hover:underline"
                  >
                    + Repuesto manual
                  </button>
                  <button
                    type="button"
                    onClick={guardarRepuestos}
                    disabled={loading}
                    className="text-[11.5px] text-[#3a4150] font-bold hover:underline disabled:opacity-50"
                  >
                    Guardar repuestos
                  </button>
                </div>
              </div>
              <InventarioPicker
                className="max-w-md"
                clienteId={ot.clienteId}
                placeholder="Agregar desde inventario (nombre o SKU)…"
                onSelect={(item: InventarioOption | null) => {
                  if (!item) return
                  setRepuestos([
                    ...repuestos,
                    {
                      id: `inv-${item.id}-${Date.now()}`,
                      descripcion: item.nombre,
                      cantidad: 1,
                      precioUnit: item.precioUnit ?? 0,
                      inventarioId: item.id,
                      otId: ot.id,
                    },
                  ])
                }}
              />
              <p className="text-[11px] text-[#9aa1ab]">
                Al cerrar la OT se descuenta stock de repuestos vinculados al inventario.
              </p>
            </CardHeader>
            <table className="w-full">
              <thead>
                <tr>
                  {['Descripción', 'Cant.', 'P. unit.', 'Subtotal', ''].map((h, i) => (
                    <th key={i} className={`px-[18px] py-2.5 text-[10px] font-bold text-[#8a909a] tracking-[0.5px] uppercase border-b border-[#f0f1f4] ${i > 0 ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {repuestos.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                    <td className="px-[18px] py-[11px] border-b border-[#f4f5f7]">
                      <input
                        value={r.descripcion}
                        onChange={(e) => {
                          const updated = [...repuestos]
                          updated[i].descripcion = e.target.value
                          setRepuestos(updated)
                        }}
                        placeholder="Descripción del repuesto"
                        className="text-[12.5px] text-[#3a4150] bg-transparent border-none outline-none w-full"
                      />
                      {r.inventarioId && (
                        <p className="text-[10px] text-[#22c55e] font-semibold mt-0.5">Vinculado al inventario</p>
                      )}
                    </td>
                    <td className="px-[18px] py-[11px] border-b border-[#f4f5f7] text-right">
                      <input
                        type="number"
                        value={r.cantidad}
                        onChange={(e) => {
                          const updated = [...repuestos]
                          updated[i].cantidad = Number(e.target.value)
                          setRepuestos(updated)
                        }}
                        className="text-[12.5px] text-[#3a4150] bg-transparent border-none outline-none w-16 text-right"
                      />
                    </td>
                    <td className="px-[18px] py-[11px] border-b border-[#f4f5f7] text-right">
                      <input
                        type="number"
                        value={r.precioUnit}
                        onChange={(e) => {
                          const updated = [...repuestos]
                          updated[i].precioUnit = Number(e.target.value)
                          setRepuestos(updated)
                        }}
                        className="text-[12.5px] text-[#6b7280] bg-transparent border-none outline-none w-24 text-right"
                      />
                    </td>
                    <td className="px-[18px] py-[11px] border-b border-[#f4f5f7] text-right text-[12.5px] font-bold text-[#1f242c]">
                      {formatMonto(r.cantidad * r.precioUnit)}
                    </td>
                    <td className="px-[18px] py-[11px] border-b border-[#f4f5f7] text-right">
                      <button onClick={() => eliminarRepuesto(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {repuestos.length === 0 && (
                  <tr><td colSpan={5} className="px-[18px] py-6 text-center text-[12.5px] text-[#9aa1ab]">Sin repuestos registrados</td></tr>
                )}
              </tbody>
            </table>
            {repuestos.length > 0 && (
              <div className="px-[18px] py-3 border-t border-[#f0f1f4] flex justify-end">
                <span className="text-[13px] font-bold text-[#1f242c]">
                  Total: {formatMonto(totalRepuestos)}
                </span>
              </div>
            )}
          </Card>
        </div>

        {/* Panel derecho — Timeline */}
        <Card>
          <CardTitle className="mb-4">Historial de estados</CardTitle>
          <OTTimeline
            historial={ot.historial ?? []}
            tecnicoNombre={ot.tecnico?.nombre}
          />
          {(ot.historial ?? []).length === 0 && (
            <p className="text-[12.5px] text-[#9aa1ab] text-center py-4">Sin historial</p>
          )}
        </Card>
      </div>
    </div>
  )
}
