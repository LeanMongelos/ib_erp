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
import { calcularPrecioNeto } from '@/lib/compras/bonificacion'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'
import type { TipoCompraProveedor, TipoFacturaCompra } from '@/types'

interface ItemRow {
  id: string
  descripcion: string
  concepto: string
  cantidad: number
  precioUnitario: number
  precioLista?: number
  bonificacionPct: number
  alicuotaIvaPct: number
  inventarioId?: string
  itemOrdenCompraId?: string
}

interface OrdenCompraOption {
  id: string
  numero: string
  estado: string
  proveedorId?: string
}

interface TipoComprobanteOption {
  id: string
  codigoAfip: number
  letra: string
  descripcion: string
}

interface ProveedorOption {
  id: string
  razonSocial: string
  tipoCompra?: TipoCompraProveedor
}

interface CuotaRow {
  id: string
  numeroCuota: number
  fecha: string
  monto: number
}

const RESULTADO_CONSTATACION: Record<string, { label: string; cls: string }> = {
  A: { label: 'Aprobado', cls: 'bg-green-100 text-green-800' },
  O: { label: 'Observado', cls: 'bg-amber-100 text-amber-800' },
  R: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
}

function addDaysIso(iso: string, dias: number): string {
  const d = new Date(iso || new Date().toISOString().slice(0, 10))
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

const TIPO_FC_OPTIONS = [
  { value: 'REMITO', label: 'Remito (stock / equipos)' },
  { value: 'CONCEPTOS', label: 'Conceptos (gastos)' },
]

export function FacturaCompraFormModal({
  fcId,
  proveedores,
  tiposComprobante = [],
  ordenCompraPrefill,
  tipoInicial,
  onClose,
  onSaved,
}: {
  fcId?: string
  proveedores: ProveedorOption[]
  tiposComprobante?: TipoComprobanteOption[]
  ordenCompraPrefill?: { id: string; numero: string; proveedorId: string }
  tipoInicial?: TipoFacturaCompra
  onClose: () => void
  onSaved: () => void
}) {
  const esEdicion = Boolean(fcId)
  const [cargando, setCargando] = useState(esEdicion)
  const [loading, setLoading] = useState(false)
  const [tipo, setTipo] = useState<TipoFacturaCompra>(tipoInicial ?? 'REMITO')
  const [proveedorId, setProveedorId] = useState(ordenCompraPrefill?.proveedorId ?? '')
  const [ordenCompraId, setOrdenCompraId] = useState(ordenCompraPrefill?.id ?? '')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [puntoVenta, setPuntoVenta] = useState('1')
  const [numeroComprobante, setNumeroComprobante] = useState('')
  const [tipoComprobanteAfipId, setTipoComprobanteAfipId] = useState('')
  const [fcSinRecepcion, setFcSinRecepcion] = useState(false)
  const [notaFcSinRecepcion, setNotaFcSinRecepcion] = useState('')
  const [ocsAprobadas, setOcsAprobadas] = useState<OrdenCompraOption[]>([])
  const [items, setItems] = useState<ItemRow[]>([
    { id: '1', descripcion: '', concepto: '', cantidad: 1, precioUnitario: 0, bonificacionPct: 0, alicuotaIvaPct: 21 },
  ])
  const [moneda, setMoneda] = useState('ARS')
  const [monedaOc, setMonedaOc] = useState<string | null>(null)
  const [notaMonedaOc, setNotaMonedaOc] = useState('')
  const [cae, setCae] = useState('')
  const [caeVencimiento, setCaeVencimiento] = useState('')
  const [constatacionResultado, setConstatacionResultado] = useState<string | null>(null)
  const [estadoFc, setEstadoFc] = useState<string>('BORRADOR')
  const [constatando, setConstatando] = useState(false)
  const [cuotas, setCuotas] = useState<CuotaRow[]>([
    { id: '1', numeroCuota: 1, fecha: addDaysIso(new Date().toISOString().slice(0, 10), 30), monto: 0 },
  ])

  const esBorrador = estadoFc === 'BORRADOR'

  const tipoCompraFilter = tipo === 'REMITO' ? 'REMITO' : 'CONCEPTOS'

  const totalEstimado = useMemo(() => {
    return items.reduce((acc, it) => {
      const netoUnit = calcularPrecioNeto(it.precioLista, it.bonificacionPct, it.precioUnitario)
      const neto = it.cantidad * netoUnit
      const iva = neto * (it.alicuotaIvaPct / 100)
      return acc + neto + iva
    }, 0)
  }, [items])

  const monedaDistintaOc = monedaOc != null && moneda !== monedaOc

  const sumaCuotas = useMemo(
    () => Math.round(cuotas.reduce((a, c) => a + c.monto, 0) * 100) / 100,
    [cuotas],
  )

  useEffect(() => {
    if (cuotas.length === 1 && cuotas[0].monto === 0 && totalEstimado > 0) {
      setCuotas((prev) => prev.map((c) => ({ ...c, monto: Math.round(totalEstimado * 100) / 100 })))
    }
  }, [totalEstimado, cuotas.length])

  useEffect(() => {
    if (!fcId) {
      if (ordenCompraPrefill?.id) {
        cargarItemsDesdeOc(ordenCompraPrefill.id)
      }
      return
    }
    let cancel = false
    ;(async () => {
      try {
        const res = await fetch(`/api/compras/facturas/${fcId}`)
        const data = await res.json()
        if (cancel || !res.ok) return
        setTipo(data.tipo)
        setProveedorId(data.proveedor?.id ?? data.proveedorId ?? '')
        setOrdenCompraId(data.ordenCompraId ?? '')
        setFecha(data.fecha?.slice(0, 10) ?? '')
        setFechaVencimiento(data.fechaVencimiento?.slice(0, 10) ?? '')
        setPuntoVenta(String(data.puntoVenta ?? 1))
        setNumeroComprobante(String(data.numeroComprobante ?? ''))
        setTipoComprobanteAfipId(data.tipoComprobanteAfipId ?? '')
        setFcSinRecepcion(data.fcSinRecepcion ?? false)
        setNotaFcSinRecepcion(data.notaFcSinRecepcion ?? '')
        setMoneda(data.moneda ?? 'ARS')
        setMonedaOc(data.ordenCompra?.moneda ?? null)
        setNotaMonedaOc(data.notaMonedaOc ?? '')
        setCae(data.cae ?? '')
        setCaeVencimiento(data.caeVencimiento?.slice(0, 10) ?? '')
        setConstatacionResultado(data.constatacionResultado ?? null)
        setEstadoFc(data.estado ?? 'BORRADOR')
        if (data.vencimientos?.length) {
          setCuotas(
            data.vencimientos.map((v: { numeroCuota: number; fecha: string; monto: number }, idx: number) => ({
              id: String(idx + 1),
              numeroCuota: v.numeroCuota,
              fecha: v.fecha?.slice(0, 10) ?? '',
              monto: v.monto,
            })),
          )
        }
        setItems(
          data.items.map((it: ItemRow, idx: number) => ({
            id: String(idx + 1),
            descripcion: it.descripcion,
            concepto: it.concepto ?? '',
            cantidad: it.cantidad,
            precioUnitario: it.precioUnitario,
            precioLista: it.precioLista ?? undefined,
            bonificacionPct: it.bonificacionPct ?? 0,
            alicuotaIvaPct: it.alicuotaIvaPct ?? 21,
            inventarioId: it.inventarioId,
            itemOrdenCompraId: it.itemOrdenCompraId,
          })),
        )
      } catch {
        toast.error('No se pudo cargar la factura')
      } finally {
        if (!cancel) setCargando(false)
      }
    })()
    return () => { cancel = true }
  }, [fcId, ordenCompraPrefill?.id])

  useEffect(() => {
    if (!proveedorId || tipo !== 'CONCEPTOS') {
      setOcsAprobadas([])
      return
    }
    let cancel = false
    ;(async () => {
      const res = await fetch(`/api/ordenes-compra?proveedorId=${proveedorId}`)
      const data = await res.json()
      if (cancel || !res.ok || !Array.isArray(data)) return
      setOcsAprobadas(
        data.filter((o: OrdenCompraOption) =>
          ['APROBADA', 'ENVIADA', 'PARCIAL', 'RECIBIDA'].includes(o.estado),
        ),
      )
    })()
    return () => { cancel = true }
  }, [proveedorId, tipo])

  async function cargarItemsDesdeOc(ocId: string) {
    try {
      const res = await fetch(`/api/ordenes-compra/${ocId}`)
      const oc = await res.json()
      if (!res.ok) return
      setProveedorId(oc.proveedor?.id ?? oc.proveedorId ?? '')
      setOrdenCompraId(ocId)
      setMoneda(oc.moneda ?? oc.proveedor?.moneda ?? 'ARS')
      setMonedaOc(oc.moneda ?? null)
      setItems(
        oc.items.map((it: {
          id: string
          descripcion: string
          concepto?: string | null
          cantidad: number
          cantidadRecibida: number
          precioUnit: number
          precioLista?: number | null
          bonificacionPct?: number
          inventarioId?: string | null
        }, idx: number) => ({
          id: String(idx + 1),
          descripcion: it.descripcion,
          concepto: it.concepto ?? '',
          cantidad: tipo === 'REMITO' && it.cantidadRecibida > 0 ? it.cantidadRecibida : it.cantidad,
          precioUnitario: it.precioUnit,
          precioLista: it.precioLista ?? undefined,
          bonificacionPct: it.bonificacionPct ?? 0,
          alicuotaIvaPct: 21,
          inventarioId: it.inventarioId ?? undefined,
          itemOrdenCompraId: it.id,
        })),
      )
    } catch {
      /* ignore */
    }
  }

  function agregarItem() {
    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        descripcion: '',
        concepto: '',
        cantidad: 1,
        precioUnitario: 0,
        bonificacionPct: 0,
        alicuotaIvaPct: 21,
      },
    ])
  }

  function quitarItem(id: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((i) => i.id !== id)))
  }

  function agregarCuota() {
    setCuotas((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        numeroCuota: prev.length + 1,
        fecha: addDaysIso(fecha, 30 * (prev.length + 1)),
        monto: 0,
      },
    ])
  }

  function quitarCuota(id: string) {
    setCuotas((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, numeroCuota: i + 1 }))
    })
  }

  function plantillaCuotas(tipo: '30' | '306090') {
    const total = Math.round(totalEstimado * 100) / 100
    if (tipo === '30') {
      setCuotas([{ id: '1', numeroCuota: 1, fecha: addDaysIso(fecha, 30), monto: total }])
      return
    }
    const tercio = Math.round((total / 3) * 100) / 100
    const resto = Math.round((total - tercio * 2) * 100) / 100
    setCuotas([
      { id: '1', numeroCuota: 1, fecha: addDaysIso(fecha, 30), monto: tercio },
      { id: '2', numeroCuota: 2, fecha: addDaysIso(fecha, 60), monto: tercio },
      { id: '3', numeroCuota: 3, fecha: addDaysIso(fecha, 90), monto: resto },
    ])
  }

  async function constatarAfip() {
    if (!fcId) {
      toast.error('Guardá la factura antes de constatar')
      return
    }
    if (!cae.trim()) {
      toast.error('Indicá el CAE')
      return
    }
    setConstatando(true)
    try {
      const res = await fetch(`/api/compras/facturas/${fcId}/constatar`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo constatar'))
      setConstatacionResultado(data.constatacionResultado ?? data.constatacion?.resultado ?? null)
      toast.success(
        data.constatacionResultado === 'A' || data.constatacion?.resultado === 'A'
          ? 'Comprobante constatado en AFIP'
          : 'Constatación completada con observaciones',
      )
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo constatar'))
    } finally {
      setConstatando(false)
    }
  }

  async function guardar(registrar: boolean) {
    if (!proveedorId) { toast.error('Seleccioná un proveedor'); return }
    if (tipo === 'CONCEPTOS' && !ordenCompraId) {
      toast.error('Las facturas de conceptos requieren una OC aprobada')
      return
    }
    const numComp = Number(numeroComprobante)
    if (!numComp || numComp < 1) { toast.error('Indicá el número de comprobante del proveedor'); return }

    if (Math.abs(sumaCuotas - totalEstimado) > 0.01) {
      toast.error('La suma de cuotas debe coincidir con el total de la factura')
      return
    }

    if (registrar && !cae.trim()) {
      toast.warning('Registrando sin CAE — considerá cargarlo y constatar en AFIP')
    }

    if (monedaDistintaOc && !notaMonedaOc.trim()) {
      toast.error('La moneda difiere de la OC; indicá una nota explicativa')
      return
    }

    const payload = {
      proveedorId,
      tipo,
      fecha,
      fechaVencimiento: fechaVencimiento || null,
      puntoVenta: Number(puntoVenta) || 1,
      numeroComprobante: numComp,
      tipoComprobanteAfipId: tipoComprobanteAfipId || null,
      moneda,
      ordenCompraId: ordenCompraId || null,
      fcSinRecepcion: tipo === 'REMITO' ? fcSinRecepcion : false,
      notaFcSinRecepcion: tipo === 'REMITO' && fcSinRecepcion ? notaFcSinRecepcion : null,
      notaMonedaOc: monedaDistintaOc ? notaMonedaOc.trim() : null,
      cae: cae.trim() || null,
      caeVencimiento: caeVencimiento || null,
      cuotas: cuotas.map((c) => ({
        numeroCuota: c.numeroCuota,
        fecha: c.fecha,
        monto: c.monto,
      })),
      items: items.map((it) => ({
        descripcion: it.descripcion,
        concepto: it.concepto || null,
        cantidad: it.cantidad,
        precioUnitario: calcularPrecioNeto(it.precioLista, it.bonificacionPct, it.precioUnitario),
        precioLista: it.precioLista ?? null,
        bonificacionPct: it.bonificacionPct,
        alicuotaIvaPct: it.alicuotaIvaPct,
        inventarioId: it.inventarioId ?? null,
        itemOrdenCompraId: it.itemOrdenCompraId ?? null,
      })),
      registrar,
    }

    setLoading(true)
    try {
      const res = esEdicion
        ? await fetch(`/api/compras/facturas/${fcId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/compras/facturas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar la factura'))

      if (registrar && esEdicion) {
        const resReg = await fetch(`/api/compras/facturas/${fcId}/registrar`, { method: 'POST' })
        if (!resReg.ok) {
          const regData = await resReg.json().catch(() => ({}))
          throw new Error(mensajeErrorJson(regData, 'Guardado pero no se pudo registrar'))
        }
      }

      toast.success(registrar ? 'Factura registrada' : 'Factura guardada en borrador')
      onSaved()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar la factura'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[14px] w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#eef0f2] flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#16181d]">
            {esEdicion ? 'Editar factura de compra' : 'Nueva factura de compra'}
          </h3>
          <button type="button" onClick={onClose} className="text-[#9aa1ab] hover:text-[#1f242c]">
            <X size={18} />
          </button>
        </div>

        {cargando ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : (
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="Tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoFacturaCompra)}
                options={TIPO_FC_OPTIONS}
              />
              <ProveedorCombobox
                value={proveedorId}
                onChange={setProveedorId}
                initialOptions={proveedores}
                tipoCompraFilter={tipoCompraFilter}
                label="Proveedor"
              />
            </div>

            {tipo === 'CONCEPTOS' && (
              <Select
                label="Orden de compra aprobada"
                value={ordenCompraId}
                onChange={(e) => {
                  setOrdenCompraId(e.target.value)
                  if (e.target.value) cargarItemsDesdeOc(e.target.value)
                }}
                options={[
                  { value: '', label: 'Seleccionar OC…' },
                  ...ocsAprobadas.map((o) => ({ value: o.id, label: o.numero })),
                  ...(ordenCompraPrefill && !ocsAprobadas.some((o) => o.id === ordenCompraPrefill.id)
                    ? [{ value: ordenCompraPrefill.id, label: ordenCompraPrefill.numero }]
                    : []),
                ]}
              />
            )}

            {tipo === 'REMITO' && (
              <div className="space-y-2 rounded-[8px] border border-[#eef0f2] p-3 bg-[#fafbfc]">
                <label className="flex items-center gap-2 text-[12.5px] text-[#3a4150]">
                  <input
                    type="checkbox"
                    checked={fcSinRecepcion}
                    onChange={(e) => setFcSinRecepcion(e.target.checked)}
                  />
                  Factura antes de recepción (sin mercadería recibida)
                </label>
                {fcSinRecepcion && (
                  <textarea
                    value={notaFcSinRecepcion}
                    onChange={(e) => setNotaFcSinRecepcion(e.target.value)}
                    rows={2}
                    className="w-full border border-[#e4e7eb] rounded-[8px] px-3 py-2 text-[13px]"
                    placeholder="Motivo / referencia…"
                  />
                )}
                {ordenCompraId && (
                  <p className="text-[11px] text-[#9aa1ab]">Vinculada a OC {ordenCompraPrefill?.numero ?? ordenCompraId}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)} />
              {monedaOc && (
                <p className="text-[11px] text-[#9aa1ab] self-end pb-2 col-span-2">
                  OC en {monedaOc}
                  {monedaDistintaOc && ' — distinta de la factura'}
                </p>
              )}
            </div>

            {monedaDistintaOc && (
              <textarea
                value={notaMonedaOc}
                onChange={(e) => setNotaMonedaOc(e.target.value)}
                rows={2}
                className="w-full border border-amber-200 rounded-[8px] px-3 py-2 text-[13px] bg-amber-50/50"
                placeholder="Nota: motivo de moneda distinta a la OC…"
              />
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <Input
                label="Vencimiento"
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
              <Input
                label="Punto venta"
                type="number"
                min={1}
                value={puntoVenta}
                onChange={(e) => setPuntoVenta(e.target.value)}
              />
              <Input
                label="Nº comprobante"
                type="number"
                min={1}
                value={numeroComprobante}
                onChange={(e) => setNumeroComprobante(e.target.value)}
              />
            </div>

            {tiposComprobante.length > 0 && (
              <Select
                label="Tipo comprobante AFIP (libro compras)"
                value={tipoComprobanteAfipId}
                onChange={(e) => setTipoComprobanteAfipId(e.target.value)}
                options={[
                  { value: '', label: 'Sin especificar' },
                  ...tiposComprobante.map((t) => ({
                    value: t.id,
                    label: `${t.codigoAfip} ${t.letra} — ${t.descripcion}`,
                  })),
                ]}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-[8px] border border-[#eef0f2] p-3 bg-[#fafbfc]">
              <Input
                label="CAE (proveedor)"
                value={cae}
                onChange={(e) => setCae(e.target.value)}
                placeholder="14 dígitos"
              />
              <Input
                label="Vencimiento CAE"
                type="date"
                value={caeVencimiento}
                onChange={(e) => setCaeVencimiento(e.target.value)}
              />
              <div className="flex flex-col gap-2 justify-end">
                {constatacionResultado && (
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full w-fit ${RESULTADO_CONSTATACION[constatacionResultado]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                    AFIP: {RESULTADO_CONSTATACION[constatacionResultado]?.label ?? constatacionResultado}
                  </span>
                )}
                {esEdicion && esBorrador && (
                  <Button variant="outline" size="sm" onClick={constatarAfip} loading={constatando} disabled={!cae.trim()}>
                    Constatar en AFIP
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#6b7280] uppercase tracking-wide">Ítems</span>
                <Button variant="outline" size="sm" onClick={agregarItem}>
                  <Plus size={14} /> Ítem
                </Button>
              </div>
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-end border border-[#eef0f2] rounded-[8px] p-2">
                  <div className="col-span-12 md:col-span-4">
                    <Input
                      label="Descripción"
                      value={item.descripcion}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((r) => (r.id === item.id ? { ...r, descripcion: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Input
                      label="Cant."
                      type="number"
                      min={0}
                      step="any"
                      value={item.cantidad}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((r) => (r.id === item.id ? { ...r, cantidad: Number(e.target.value) } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-3 md:col-span-1">
                    <Input
                      label="P. lista"
                      type="number"
                      min={0}
                      step="any"
                      value={item.precioLista ?? ''}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((r) =>
                            r.id === item.id
                              ? { ...r, precioLista: e.target.value === '' ? undefined : Number(e.target.value) }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-3 md:col-span-1">
                    <Input
                      label="Bonif. %"
                      type="number"
                      min={0}
                      max={100}
                      value={item.bonificacionPct}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((r) => (r.id === item.id ? { ...r, bonificacionPct: Number(e.target.value) } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-3 md:col-span-1">
                    <Input
                      label="Neto u."
                      type="number"
                      min={0}
                      step="any"
                      value={calcularPrecioNeto(item.precioLista, item.bonificacionPct, item.precioUnitario)}
                      readOnly
                    />
                  </div>
                  <div className="col-span-3 md:col-span-1">
                    <Input
                      label="IVA %"
                      type="number"
                      min={0}
                      value={item.alicuotaIvaPct}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((r) => (r.id === item.id ? { ...r, alicuotaIvaPct: Number(e.target.value) } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => quitarItem(item.id)}
                      className="text-[#9aa1ab] hover:text-red-600 p-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {esBorrador && (
              <div className="space-y-2 rounded-[8px] border border-[#eef0f2] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-[#6b7280] uppercase tracking-wide">Cuotas AP</span>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => plantillaCuotas('30')}>30 días</Button>
                    <Button variant="ghost" size="sm" onClick={() => plantillaCuotas('306090')}>30/60/90</Button>
                    <Button variant="outline" size="sm" onClick={agregarCuota}><Plus size={14} /> Cuota</Button>
                  </div>
                </div>
                {cuotas.map((c) => (
                  <div key={c.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <Input label="Nº" type="number" min={1} value={c.numeroCuota} readOnly />
                    </div>
                    <div className="col-span-4">
                      <Input
                        label="Vencimiento"
                        type="date"
                        value={c.fecha}
                        onChange={(e) =>
                          setCuotas((prev) =>
                            prev.map((r) => (r.id === c.id ? { ...r, fecha: e.target.value } : r)),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-5">
                      <Input
                        label="Monto"
                        type="number"
                        min={0}
                        step={0.01}
                        value={c.monto}
                        onChange={(e) =>
                          setCuotas((prev) =>
                            prev.map((r) => (r.id === c.id ? { ...r, monto: Number(e.target.value) } : r)),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button type="button" onClick={() => quitarCuota(c.id)} className="text-[#9aa1ab] hover:text-red-600 p-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <p className={`text-[12px] ${Math.abs(sumaCuotas - totalEstimado) > 0.01 ? 'text-red-600' : 'text-[#6b7280]'}`}>
                  Suma cuotas: {formatMonto(sumaCuotas)} / Total: {formatMonto(totalEstimado)}
                </p>
              </div>
            )}

            <p className="text-[13px] font-semibold text-[#1f242c]">
              Total estimado ({moneda}): {formatMontoMoneda(totalEstimado, moneda)}
            </p>
          </div>
        )}

        <div className="px-5 py-4 border-t border-[#eef0f2] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="outline" onClick={() => guardar(false)} loading={loading}>
            Guardar borrador
          </Button>
          <Button variant="primary" onClick={() => guardar(true)} loading={loading}>
            Registrar
          </Button>
        </div>
      </div>
    </div>
  )
}
