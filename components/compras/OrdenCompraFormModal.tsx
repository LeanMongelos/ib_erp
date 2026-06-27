'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ProveedorCombobox } from '@/components/proveedores/ProveedorCombobox'
import { formatMonto } from '@/lib/utils'
import { formatMontoMoneda } from '@/lib/compras/moneda-compra'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'
import { TimelineOrdenCompra } from '@/components/compras/TimelineOrdenCompra'
import type { TipoCompraProveedor } from '@/types'

const CLASIFICACIONES = [
  { value: 'REPUESTO_OT', label: 'Repuesto OT' },
  { value: 'STOCK_REPOSICION', label: 'Stock / reposición' },
  { value: 'EQUIPO_VENTA', label: 'Equipo venta' },
  { value: 'SHOWROOM_MUESTRA', label: 'Showroom / muestra' },
  { value: 'GASTO_EDILICIO', label: 'Gasto edilicio' },
  { value: 'ALQUILER', label: 'Alquiler' },
  { value: 'SERVICIO', label: 'Servicio' },
  { value: 'OTRO', label: 'Otro' },
] as const

interface ItemRow {
  id: string
  descripcion: string
  concepto: string
  cantidad: number
  precioUnit: number
  precioLista?: number
  bonificacionPct: number
  inventarioId?: string
  depositoDestinoId?: string
}

interface OrdenCompraDetalle {
  id: string
  numero: string
  estado: string
  proveedorId?: string
  observaciones?: string | null
  solicitanteId?: string | null
  justificacion?: string | null
  clasificacionOrigen?: string | null
  ordenTrabajoId?: string | null
  presupuestoId?: string | null
  clienteId?: string | null
  depositoDestinoDefaultId?: string | null
  moneda?: string
  cotizacionUsd?: number | null
  proveedor?: { id: string; razonSocial: string; tipoCompra?: TipoCompraProveedor; moneda?: string }
  ordenTrabajo?: { id: string; numero: string } | null
  presupuesto?: { id: string; numero: string } | null
  items: Array<{
    descripcion: string
    concepto?: string | null
    cantidad: number
    precioUnit: number
    precioLista?: number | null
    bonificacionPct?: number
    inventarioId?: string | null
    depositoDestinoId?: string | null
  }>
}

interface ProveedorOption {
  id: string
  razonSocial: string
  moneda?: string
}

export function OrdenCompraFormModal({
  ocId,
  proveedores,
  usuarios = [],
  depositos = [],
  actorId,
  cotizacionUsdDefault,
  tipoCompraFilter,
  onClose,
  onSaved,
}: {
  ocId?: string
  proveedores: ProveedorOption[]
  usuarios?: { id: string; nombre: string }[]
  depositos?: { id: string; nombre: string }[]
  actorId?: string
  cotizacionUsdDefault?: number | null
  tipoCompraFilter?: TipoCompraProveedor
  onClose: () => void
  onSaved: () => void
}) {
  const esEdicion = Boolean(ocId)
  const [cargando, setCargando] = useState(esEdicion)
  const [loading, setLoading] = useState(false)
  const [proveedorId, setProveedorId] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [solicitanteId, setSolicitanteId] = useState(actorId ?? '')
  const [justificacion, setJustificacion] = useState('')
  const [clasificacionOrigen, setClasificacionOrigen] = useState('')
  const [depositoDestinoDefaultId, setDepositoDestinoDefaultId] = useState('')
  const [moneda, setMoneda] = useState('ARS')
  const [cotizacionUsd, setCotizacionUsd] = useState<number | ''>('')
  const [ordenTrabajoId, setOrdenTrabajoId] = useState('')
  const [presupuestoId, setPresupuestoId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [items, setItems] = useState<ItemRow[]>([
    { id: '1', descripcion: '', concepto: '', cantidad: 1, precioUnit: 0, bonificacionPct: 0 },
  ])
  const [productosProveedor, setProductosProveedor] = useState<Array<{
    id: string
    nombreProducto: string
    costo: number
    bonificacionPct?: number
    inventarioId?: string | null
  }>>([])

  useEffect(() => {
    if (!ocId) {
      if (actorId) setSolicitanteId(actorId)
      return
    }
    let cancel = false
    ;(async () => {
      try {
        const res = await fetch(`/api/ordenes-compra/${ocId}`)
        const data: OrdenCompraDetalle = await res.json()
        if (cancel || !res.ok) return
        setProveedorId(data.proveedor?.id ?? data.proveedorId ?? '')
        setObservaciones(data.observaciones ?? '')
        setSolicitanteId(data.solicitanteId ?? actorId ?? '')
        setJustificacion(data.justificacion ?? '')
        setClasificacionOrigen(data.clasificacionOrigen ?? '')
        setDepositoDestinoDefaultId(data.depositoDestinoDefaultId ?? '')
        setMoneda(data.moneda ?? 'ARS')
        setCotizacionUsd(data.cotizacionUsd ?? '')
        setOrdenTrabajoId(data.ordenTrabajoId ?? '')
        setPresupuestoId(data.presupuestoId ?? '')
        setClienteId(data.clienteId ?? '')
        setItems(
          data.items.map((it, idx) => ({
            id: String(idx + 1),
            descripcion: it.descripcion,
            concepto: it.concepto ?? '',
            cantidad: it.cantidad,
            precioUnit: it.precioUnit,
            precioLista: it.precioLista ?? undefined,
            bonificacionPct: it.bonificacionPct ?? 0,
            inventarioId: it.inventarioId ?? undefined,
            depositoDestinoId: it.depositoDestinoId ?? undefined,
          })),
        )
      } catch (e) {
        toast.error(mensajeErrorDesconocido(e, 'No se pudo cargar la orden de compra'))
      } finally {
        if (!cancel) setCargando(false)
      }
    })()
    return () => { cancel = true }
  }, [ocId, actorId])

  useEffect(() => {
    const prov = proveedores.find((p) => p.id === proveedorId)
    if (prov?.moneda) setMoneda(prov.moneda)
  }, [proveedorId, proveedores])

  useEffect(() => {
    if (!proveedorId) {
      setProductosProveedor([])
      return
    }
    let cancel = false
    ;(async () => {
      try {
        const res = await fetch(`/api/proveedores/${proveedorId}`)
        const data = await res.json()
        if (cancel || !res.ok) return
        setProductosProveedor(
          (data.productos ?? []).map((p: {
            id: string
            nombreProducto: string
            costo: number
            bonificacionPct?: number
            inventarioId?: string | null
          }) => p),
        )
      } catch {
        if (!cancel) setProductosProveedor([])
      }
    })()
    return () => { cancel = true }
  }, [proveedorId])

  const total = useMemo(
    () => items.reduce((a, i) => {
      const neto = i.precioLista != null && i.precioLista > 0
        ? i.precioLista * (1 - (i.bonificacionPct || 0) / 100)
        : i.precioUnit
      return a + i.cantidad * neto
    }, 0),
    [items],
  )

  function aplicarProducto(idx: number, productoId: string) {
    const prod = productosProveedor.find((p) => p.id === productoId)
    if (!prod) return
    const neto = prod.costo * (1 - (prod.bonificacionPct ?? 0) / 100)
    setItems((rows) =>
      rows.map((r, i) =>
        i === idx
          ? {
              ...r,
              descripcion: prod.nombreProducto,
              precioLista: prod.costo,
              bonificacionPct: prod.bonificacionPct ?? 0,
              precioUnit: Math.round(neto * 100) / 100,
              inventarioId: prod.inventarioId ?? undefined,
            }
          : r,
      ),
    )
  }
  function updateItem(idx: number, field: keyof ItemRow, value: string | number) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  function buildPayload(enviar: boolean) {
    const validItems = items.filter((i) => i.descripcion.trim())
    if (validItems.length === 0) throw new Error('Agregá al menos un ítem')
    if (enviar) {
      if (!solicitanteId) throw new Error('Indicá el solicitante')
      if (!justificacion.trim()) throw new Error('La justificación es obligatoria')
      if (!clasificacionOrigen) throw new Error('Seleccioná la clasificación')
    }
    return {
      proveedorId,
      observaciones: observaciones.trim() || undefined,
      solicitanteId: solicitanteId || null,
      justificacion: justificacion.trim() || null,
      clasificacionOrigen: clasificacionOrigen || null,
      ordenTrabajoId: ordenTrabajoId.trim() || null,
      presupuestoId: presupuestoId.trim() || null,
      clienteId: clienteId.trim() || null,
      depositoDestinoDefaultId: depositoDestinoDefaultId || null,
      moneda,
      cotizacionUsd: moneda === 'USD' ? (cotizacionUsd === '' ? cotizacionUsdDefault ?? null : Number(cotizacionUsd)) : null,
      items: validItems.map((i) => ({
        descripcion: i.descripcion.trim(),
        concepto: i.concepto.trim() || null,
        cantidad: i.cantidad,
        precioUnit: i.precioUnit,
        precioLista: i.precioLista ?? null,
        bonificacionPct: i.bonificacionPct,
        inventarioId: i.inventarioId ?? null,
        depositoDestinoId: i.depositoDestinoId ?? null,
      })),
    }
  }

  async function guardar(enviar = false) {
    if (!proveedorId) { toast.error('Seleccioná un proveedor'); return }
    setLoading(true)
    try {
      const payload = buildPayload(enviar)

      const res = esEdicion
        ? await fetch(`/api/ordenes-compra/${ocId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/ordenes-compra', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar la orden de compra'))

      if (enviar) {
        const id = esEdicion ? ocId! : data.id
        const resEnv = await fetch(`/api/ordenes-compra/${id}/enviar`, { method: 'POST' })
        const dataEnv = await resEnv.json().catch(() => ({}))
        if (!resEnv.ok) throw new Error(mensajeErrorJson(dataEnv, 'No se pudo enviar a aprobación'))
        toast.success('OC enviada a aprobación')
      } else {
        toast.success(esEdicion ? 'OC actualizada' : `OC ${data.numero} creada`)
      }

      onSaved()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar la orden de compra'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-modal-overlay>
      <div
        className="bg-white rounded-[14px] w-full max-w-4xl shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef0f2] sticky top-0 bg-white z-10">
          <h3 className="text-[14px] font-bold text-[#16181d]">
            {esEdicion ? 'Editar orden de compra' : 'Nueva orden de compra'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {cargando ? (
          <p className="p-10 text-center text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ProveedorCombobox
                value={proveedorId}
                onChange={setProveedorId}
                initialOptions={proveedores}
                tipoCompraFilter={tipoCompraFilter}
                label="Proveedor"
              />
              <Select
                label="Solicitante"
                value={solicitanteId}
                onChange={(e) => setSolicitanteId(e.target.value)}
                placeholder="— Seleccionar —"
                options={usuarios.map((u) => ({ value: u.id, label: u.nombre }))}
              />
              <Select
                label="Clasificación"
                value={clasificacionOrigen}
                onChange={(e) => setClasificacionOrigen(e.target.value)}
                placeholder="— Seleccionar —"
                options={CLASIFICACIONES.map((c) => ({ value: c.value, label: c.label }))}
              />
              <Select
                label="Depósito destino (default)"
                value={depositoDestinoDefaultId}
                onChange={(e) => setDepositoDestinoDefaultId(e.target.value)}
                placeholder="— Sin default —"
                options={depositos.map((d) => ({ value: d.id, label: d.nombre }))}
              />
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide">Justificación</label>
                <textarea
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  rows={2}
                  className="border border-[#e4e7eb] rounded-[8px] px-3 py-2 text-[13px] resize-none"
                  placeholder="Motivo de la compra…"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide">Observaciones</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  className="border border-[#e4e7eb] rounded-[8px] px-3 py-2 text-[13px] resize-none"
                  placeholder="Notas internas…"
                />
              </div>
              <Input label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)} />
              {moneda === 'USD' && (
                <Input
                  label="Cotización USD"
                  type="number"
                  min={0}
                  step="0.01"
                  value={cotizacionUsd}
                  placeholder={cotizacionUsdDefault != null ? String(cotizacionUsdDefault) : ''}
                  onChange={(e) => setCotizacionUsd(e.target.value === '' ? '' : Number(e.target.value))}
                />
              )}
              <Input label="OT (id opcional)" value={ordenTrabajoId} onChange={(e) => setOrdenTrabajoId(e.target.value)} placeholder="Vincular OT…" />
              <Input label="Presupuesto (id opcional)" value={presupuestoId} onChange={(e) => setPresupuestoId(e.target.value)} />
              <Input label="Cliente (id opcional)" value={clienteId} onChange={(e) => setClienteId(e.target.value)} />
            </div>

            {esEdicion && ocId && (
              <TimelineOrdenCompra ocId={ocId} />
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide">Ítems</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setItems((s) => [
                      ...s,
                      { id: String(Date.now()), descripcion: '', concepto: '', cantidad: 1, precioUnit: 0, bonificacionPct: 0 },
                    ])
                  }
                >
                  <Plus size={14} /> Agregar ítem
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end border border-[#eef0f2] rounded-[10px] p-3">
                    <div className="col-span-12 md:col-span-3">
                      <Input
                        label="Descripción"
                        value={item.descripcion}
                        onChange={(e) => updateItem(idx, 'descripcion', e.target.value)}
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Input
                        label="Concepto"
                        value={item.concepto}
                        onChange={(e) => updateItem(idx, 'concepto', e.target.value)}
                      />
                    </div>
                    <div className="col-span-3 md:col-span-1">
                      <Input
                        label="Cant."
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={(e) => updateItem(idx, 'cantidad', Number(e.target.value))}
                      />
                    </div>
                    {productosProveedor.length > 0 && (
                      <div className="col-span-12 md:col-span-3">
                        <Select
                          label="Producto proveedor"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) aplicarProducto(idx, e.target.value)
                          }}
                          placeholder="Elegir de lista…"
                          options={[
                            { value: '', label: '—' },
                            ...productosProveedor.map((p) => ({
                              value: p.id,
                              label: `${p.nombreProducto}${p.bonificacionPct ? ` (bonif. ${p.bonificacionPct}%)` : ''}`,
                            })),
                          ]}
                        />
                      </div>
                    )}
                    <div className="col-span-3 md:col-span-1">
                      <Input
                        label="P. lista"
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.precioLista ?? ''}
                        onChange={(e) =>
                          updateItem(idx, 'precioLista', e.target.value === '' ? '' : Number(e.target.value))
                        }
                      />
                    </div>
                    <div className="col-span-3 md:col-span-1">
                      <Input
                        label="Precio neto"
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.precioUnit}
                        onChange={(e) => updateItem(idx, 'precioUnit', Number(e.target.value))}
                      />
                    </div>
                    <div className="col-span-3 md:col-span-1">
                      <Input
                        label="Bonif. %"
                        type="number"
                        min={0}
                        max={100}
                        value={item.bonificacionPct}
                        onChange={(e) => updateItem(idx, 'bonificacionPct', Number(e.target.value))}
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Select
                        label="Depósito ítem"
                        value={item.depositoDestinoId ?? ''}
                        onChange={(e) => updateItem(idx, 'depositoDestinoId', e.target.value)}
                        placeholder="Default OC"
                        options={depositos.map((d) => ({ value: d.id, label: d.nombre }))}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-1 flex justify-end">
                      <button
                        type="button"
                        className="text-[#9aa1ab] hover:text-red-500 p-2"
                        onClick={() => setItems((s) => (s.length > 1 ? s.filter((_, i) => i !== idx) : s))}
                        aria-label="Quitar ítem"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#eef0f2]">
              <p className="text-[13px] font-bold text-[#1f242c]">Total ({moneda}): {formatMontoMoneda(total, moneda)}</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
                <Button variant="outline" onClick={() => guardar(false)} loading={loading}>Guardar borrador</Button>
                <Button variant="primary" onClick={() => guardar(true)} loading={loading}>Enviar a aprobación</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
