'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatMontoMoneda, etiquetaMoneda, type MonedaDocumento } from '@/lib/moneda'
import { validarMonedaDocumentoCliente } from '@/lib/moneda-documento-client'
import { MonedaDocumentoPanel } from '@/components/fiscal/MonedaDocumentoPanel'
import { calcularTotales, resumenIvaPorAlicuota } from '@/lib/documentos'
import { AlicuotaSelector } from '@/components/fiscal/AlicuotaSelector'
import { useAlicuotasIva } from '@/components/fiscal/useAlicuotasIva'
import { resolverPorcentajeCliente } from '@/lib/iva/sugerir-alicuota'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { InventarioPicker, type InventarioOption } from '@/components/inventario/InventarioPicker'
import { ClienteCombobox } from '@/components/clientes/ClienteCombobox'
import { Select } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { FORMA_PAGO, PLAZO_ENTREGA, GARANTIA, VIGENCIA_DIAS } from '@/lib/form-options'
import {
  PlazosFinanciacionPanel,
  estadoInicialPlazos,
  plazosDesdeEstado,
} from '@/components/cobranzas/PlazosFinanciacionPanel'
import { formatCondicionPago } from '@/lib/cobranzas/plazos'
import { calcularInteresFinanciacion } from '@/lib/cobranzas/financiacion'
import type { PresetPlazoKey } from '@/lib/cobranzas/plazos'

interface ItemRow {
  id: string
  descripcion: string
  cantidad: number
  precioUnit: number
  alicuotaIvaPct?: number
  inventarioId?: string
  codigo?: string
  fotoUrl?: string
  tipoArticulo?: string
  esSerializado?: boolean
  numeroSerie?: string
  proximoPreventivo?: string
}

interface ClienteOption {
  id: string
  nombre: string
  condicionIva?: string | null
  alicuotaIva?: { porcentaje: number } | null
}

interface Props {
  clientes: ClienteOption[]
  emisores: { id: string; razonSocial: string; predeterminado?: boolean }[]
  clienteEventualId?: string
  clienteInicialId?: string
  otPrefill?: {
    id: string
    numero: string
    clienteId: string
    descripcion: string
    diagnostico?: string | null
    repuestos?: { descripcion: string; cantidad: number; precioUnit: number }[]
  } | null
  plantillaPresupuesto: { id: string | null; nombre: string; origen: string }
}

function itemsDesdeOt(ot: NonNullable<Props['otPrefill']>): ItemRow[] {
  const filas: ItemRow[] = []
  if (ot.repuestos?.length) {
    for (const r of ot.repuestos) {
      if (r.descripcion?.trim()) {
        filas.push({
          id: `rep-${r.descripcion}`,
          descripcion: r.descripcion,
          cantidad: r.cantidad,
          precioUnit: r.precioUnit,
        })
      }
    }
  }
  const servicio = ot.diagnostico?.trim() || ot.descripcion?.trim()
  if (servicio) {
    filas.unshift({
      id: 'servicio',
      descripcion: `Servicio técnico — ${servicio.slice(0, 120)}`,
      cantidad: 1,
      precioUnit: 0,
    })
  }
  return filas.length ? filas : [{ id: '1', descripcion: '', cantidad: 1, precioUnit: 0 }]
}

export function NuevoPresupuestoForm({
  clientes,
  emisores,
  clienteEventualId,
  clienteInicialId,
  otPrefill,
  plantillaPresupuesto,
}: Props) {
  const router = useRouter()
  const { alicuotas, defaultPct } = useAlicuotasIva()

  const defEmisor = emisores.find((e) => e.predeterminado)?.id ?? emisores[0]?.id ?? ''
  const [clienteId, setClienteId] = useState(
    otPrefill?.clienteId ?? clienteInicialId ?? clienteEventualId ?? '',
  )
  const [emisorId, setEmisorId] = useState(defEmisor)
  const [alicuotaDocumentoPct, setAlicuotaDocumentoPct] = useState(21)
  const [vigenciaDias, setVigenciaDias] = useState(15)
  const [formaPago, setFormaPago] = useState('')
  const [plazoEntrega, setPlazoEntrega] = useState('')
  const [garantia, setGarantia] = useState('')
  const [observaciones, setObservaciones] = useState(
    otPrefill ? `Presupuesto vinculado a OT ${otPrefill.numero}` : '',
  )
  const [items, setItems] = useState<ItemRow[]>(() =>
    otPrefill ? itemsDesdeOt(otPrefill) : [{ id: '1', descripcion: '', cantidad: 1, precioUnit: 0 }],
  )
  const [loading, setLoading] = useState(false)
  const plazoInicial = estadoInicialPlazos()
  const [presetPlazo, setPresetPlazo] = useState<PresetPlazoKey | 'custom'>(plazoInicial.presetPlazo)
  const [plazosCustom, setPlazosCustom] = useState(plazoInicial.plazosCustom)
  const [tasaFinanciacionPct, setTasaFinanciacionPct] = useState(0)
  const [moneda, setMoneda] = useState<MonedaDocumento>('ARS')
  const [cotizacionUsd, setCotizacionUsd] = useState<number | null>(null)

  useEffect(() => {
    setAlicuotaDocumentoPct(defaultPct)
  }, [defaultPct])

  useEffect(() => {
    if (!clienteId) return
    const c = clientes.find((x) => x.id === clienteId)
    setAlicuotaDocumentoPct(resolverPorcentajeCliente(c, defaultPct))
  }, [clienteId, clientes, defaultPct])

  const totales = useMemo(
    () =>
      calcularTotales(
        items.filter((i) => i.descripcion).map((i) => ({
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precioUnit: i.precioUnit,
          alicuotaIvaPct: i.alicuotaIvaPct,
        })),
        0,
        alicuotaDocumentoPct,
      ),
    [items, alicuotaDocumentoPct],
  )

  const resumenIva = useMemo(
    () => resumenIvaPorAlicuota(totales.itemsCalculados),
    [totales.itemsCalculados],
  )

  const plazosActivos = useMemo(
    () => plazosDesdeEstado(presetPlazo, plazosCustom),
    [presetPlazo, plazosCustom],
  )

  const interesFinanciacion = useMemo(
    () => calcularInteresFinanciacion(totales.total, plazosActivos, tasaFinanciacionPct),
    [totales.total, plazosActivos, tasaFinanciacionPct],
  )

  const totalACobrar = totales.total + interesFinanciacion

  function addItem() {
    setItems([...items, { id: `new-${Date.now()}`, descripcion: '', cantidad: 1, precioUnit: 0 }])
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ItemRow, value: string | number | undefined) {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }

  async function guardar() {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return }
    if (items.every((i) => !i.descripcion)) { toast.error('Agregá al menos un ítem'); return }

    const errMoneda = validarMonedaDocumentoCliente(moneda, cotizacionUsd)
    if (errMoneda) {
      toast.error(errMoneda)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          otId: otPrefill?.id ?? null,
          emisorId: emisorId || null,
          plantillaId: plantillaPresupuesto.id ?? undefined,
          vigenciaDias,
          formaPago: formaPago || undefined,
          plazoEntrega: plazoEntrega || undefined,
          garantia: garantia || undefined,
          observaciones: observaciones || undefined,
          alicuotaIvaPct: alicuotaDocumentoPct,
          moneda,
          cotizacionUsd: moneda === 'USD' ? cotizacionUsd : null,
          ...(plazosActivos.length > 0
            ? {
                plazosCobranza: plazosActivos,
                condicionPago: formatCondicionPago(plazosActivos),
              }
            : {}),
          tasaFinanciacionPct,
          interesFinanciacion,
          items: items.filter((i) => i.descripcion).map((i) => ({
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precioUnit: i.precioUnit,
            alicuotaIvaPct: i.alicuotaIvaPct,
            inventarioId: i.inventarioId ?? null,
            tipoArticulo: i.tipoArticulo ?? null,
            codigo: i.codigo ?? undefined,
            fotoUrl: i.fotoUrl ?? undefined,
            numeroSerie: i.numeroSerie?.trim() || null,
            proximoPreventivo: i.proximoPreventivo || null,
          })),
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo guardar el presupuesto'))
      const data = await res.json()
      toast.success('Presupuesto creado')
      router.push(`/presupuestos/${data.id}`)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar el presupuesto'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">
      {otPrefill && (
        <div className="bg-[#EFF6FF] border border-[#93C5FD] rounded-[10px] px-4 py-3">
          <p className="text-[13px] font-bold text-[#1E40AF]">
            Presupuesto desde OT {otPrefill.numero}
          </p>
          <p className="text-[12px] text-[#3B82F6] mt-0.5">
            Los ítems se cargaron desde repuestos y diagnóstico de la orden de trabajo.
          </p>
        </div>
      )}
      <Card>
        <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <h3 className="text-[13.5px] font-bold text-[#1f242c]">Datos del presupuesto</h3>
          <div className="flex items-start gap-2 bg-[#FFFBF5] border border-[#FFE4CC] rounded-[9px] px-3 py-2 max-w-md">
            <FileText size={15} className="text-[#E8650A] shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-[#92400E] uppercase tracking-wide">Modelo de impresión</p>
              <p className="text-[12.5px] font-semibold text-[#1f242c]">{plantillaPresupuesto.nombre}</p>
              <p className="text-[11px] text-[#6b7280]">
                Configurado en Plantillas de impresión. El PDF usará este diseño al guardar.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ClienteCombobox
            value={clienteId}
            onChange={setClienteId}
            initialOptions={clientes}
            disabled={!!otPrefill}
          />
          {clienteId === clienteEventualId && (
            <p className="text-[11px] text-[#9aa1ab] col-span-2 -mt-2">
              Venta ocasional sin ficha completa. Podés cambiar el cliente antes de guardar.
            </p>
          )}
          <Select
            label="Emisor"
            value={emisorId}
            onChange={(e) => setEmisorId(e.target.value)}
            options={emisores.map((e) => ({ value: e.id, label: e.razonSocial }))}
          />
          <Select
            label="Vigencia"
            value={String(vigenciaDias)}
            onChange={(e) => setVigenciaDias(Number(e.target.value))}
            options={VIGENCIA_DIAS}
          />
          <Combobox
            label="Forma de pago"
            value={formaPago}
            onChange={setFormaPago}
            options={FORMA_PAGO}
            placeholder="Transferencia, contado…"
            allowCustom
          />
          <Combobox
            label="Plazo de entrega"
            value={plazoEntrega}
            onChange={setPlazoEntrega}
            options={PLAZO_ENTREGA}
            placeholder="30 días, inmediato…"
            allowCustom
          />
          <Combobox
            label="Garantía"
            value={garantia}
            onChange={setGarantia}
            options={GARANTIA}
            placeholder="12 meses…"
            allowCustom
          />
          <MonedaDocumentoPanel
            moneda={moneda}
            onMonedaChange={setMoneda}
            cotizacionUsd={cotizacionUsd}
            onCotizacionUsdChange={setCotizacionUsd}
            totalDocumento={totalACobrar}
          />
          <div className="flex flex-col gap-1.5 col-span-2">
            <AlicuotaSelector
              label="Alícuota IVA del comprobante"
              value={alicuotaDocumentoPct}
              onChange={setAlicuotaDocumentoPct}
              alicuotas={alicuotas}
            />
            <p className="text-[11px] text-[#9aa1ab]">
              Se sugiere según el cliente. Podés cambiarla o definir IVA distinto por ítem abajo.
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[#f0f1f4]">
          <PlazosFinanciacionPanel
            totalNeto={totales.total}
            presetPlazo={presetPlazo}
            onPresetPlazoChange={setPresetPlazo}
            plazosCustom={plazosCustom}
            onPlazosCustomChange={setPlazosCustom}
            tasaFinanciacionPct={tasaFinanciacionPct}
            onTasaFinanciacionPctChange={setTasaFinanciacionPct}
            descripcion="Plazos de cobranza propuestos al cliente. La tasa mensual aplica interés proporcional a los días de cada cuota."
          />
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">Observaciones</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2}
            autoComplete="off"
            className="bg-white border border-[#e4e7eb] rounded-[9px] px-3 py-2.5 text-[13.5px] resize-none" />
        </div>
      </Card>

      <Card padding={false}>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle>Ítems</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
            <InventarioPicker
              className="w-full sm:w-72"
              clienteId={clienteId || undefined}
              monedaDocumento={moneda}
              onSelect={(item: InventarioOption | null) => {
                if (!item) return
                const itemMoneda = (item.moneda ?? 'ARS') as MonedaDocumento
                if (itemMoneda !== moneda) {
                  setMoneda(itemMoneda)
                  if (itemMoneda === 'USD') setCotizacionUsd(null)
                  toast.info(
                    `Moneda del presupuesto cambiada a ${etiquetaMoneda(itemMoneda)} para coincidir con «${item.nombre}»`,
                  )
                }
                const esEquipo = item.tipoArticulo === 'EQUIPO'
                const d = new Date()
                if (esEquipo && item.intervaloPreventivoDias) d.setDate(d.getDate() + item.intervaloPreventivoDias)
                setItems([
                  ...items,
                  {
                    id: `inv-${item.id}-${Date.now()}`,
                    descripcion: item.nombre,
                    cantidad: 1,
                    precioUnit: item.precioUnit ?? 0,
                    alicuotaIvaPct: item.alicuotaIva?.porcentaje,
                    inventarioId: item.id,
                    codigo: item.sku ?? undefined,
                    fotoUrl: item.fotoUrl ?? undefined,
                    tipoArticulo: item.tipoArticulo,
                    esSerializado: item.esSerializado,
                    proximoPreventivo: esEquipo ? d.toISOString().slice(0, 10) : undefined,
                  },
                ])
              }}
            />
            <button onClick={addItem} className="text-[11.5px] text-[#E8650A] font-bold hover:underline whitespace-nowrap">+ Ítem manual</button>
          </div>
        </CardHeader>
        <table className="w-full">
          <thead>
            <tr>
              {['Descripción', 'Cant.', 'Precio unit.', 'IVA %', 'Serie / Preventivo', 'Subtotal', ''].map((h, i) => (
                <th key={i} className={`px-5 py-2.5 text-[10px] font-bold text-[#8a909a] tracking-[0.5px] uppercase border-b border-[#f0f1f4] ${i > 0 && i < 6 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id}>
                <td className="px-5 py-3 border-b border-[#f4f5f7]">
                  <input value={item.descripcion} onChange={(e) => updateItem(i, 'descripcion', e.target.value)}
                    placeholder="Descripción…" className="text-[12.5px] bg-transparent border-none outline-none w-full" />
                  {item.codigo && <p className="text-[10px] text-[#9aa1ab] font-mono mt-0.5">SKU {item.codigo}</p>}
                  {item.tipoArticulo === 'EQUIPO' && (
                    <p className="text-[10px] text-[#E8650A] font-semibold mt-0.5">Equipo → cliente + preventivo</p>
                  )}
                </td>
                <td className="px-5 py-3 border-b border-[#f4f5f7] text-right">
                  <input type="number" min={1} value={item.cantidad}
                    disabled={item.tipoArticulo === 'EQUIPO'}
                    onChange={(e) => updateItem(i, 'cantidad', Number(e.target.value))}
                    className="text-[12.5px] bg-transparent border-none outline-none w-14 text-right disabled:opacity-50" />
                </td>
                <td className="px-5 py-3 border-b border-[#f4f5f7] text-right">
                  <input type="number" min={0} value={item.precioUnit} onChange={(e) => updateItem(i, 'precioUnit', Number(e.target.value))}
                    className="text-[12.5px] bg-transparent border-none outline-none w-28 text-right" />
                </td>
                <td className="px-5 py-3 border-b border-[#f4f5f7] text-right">
                  <select
                    value={item.alicuotaIvaPct ?? alicuotaDocumentoPct}
                    onChange={(e) => updateItem(i, 'alicuotaIvaPct', Number(e.target.value))}
                    className="text-[11px] border border-[#e4e7eb] rounded-[6px] px-1 py-0.5"
                  >
                    {alicuotas.map((a) => (
                      <option key={a.id} value={a.porcentaje}>{a.porcentaje}%</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3 border-b border-[#f4f5f7] text-right align-top">
                  {item.tipoArticulo === 'EQUIPO' ? (
                    <div className="flex flex-col gap-1 items-end">
                      {item.esSerializado && (
                        <input
                          value={item.numeroSerie ?? ''}
                          onChange={(e) => updateItem(i, 'numeroSerie', e.target.value)}
                          placeholder="N° serie *"
                          autoComplete="off"
                          className="text-[11px] border border-[#e4e7eb] rounded px-1.5 py-0.5 w-28 text-right"
                        />
                      )}
                      <input
                        type="date"
                        value={item.proximoPreventivo ?? ''}
                        onChange={(e) => updateItem(i, 'proximoPreventivo', e.target.value)}
                        title="Próximo preventivo"
                        className="text-[11px] border border-[#e4e7eb] rounded px-1 py-0.5"
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#9aa1ab]">—</span>
                  )}
                </td>
                <td className="px-5 py-3 border-b border-[#f4f5f7] text-right text-[12.5px] font-bold">{formatMontoMoneda(item.cantidad * item.precioUnit, moneda)}</td>
                <td className="px-5 py-3 border-b border-[#f4f5f7] text-right">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-4 border-t border-[#f0f1f4] flex flex-col items-end gap-2">
          <div className="flex items-center gap-8 text-[12.5px] text-[#6b7280]"><span>Subtotal</span><span className="w-28 text-right">{formatMontoMoneda(totales.subtotal, moneda)}</span></div>
          {resumenIva.map((r) => (
            <div key={r.porcentaje} className="flex items-center gap-8 text-[12.5px] text-[#6b7280]">
              <span>IVA ({r.porcentaje}%)</span>
              <span className="w-28 text-right">{formatMontoMoneda(r.iva, moneda)}</span>
            </div>
          ))}
          {interesFinanciacion > 0 && (
            <div className="flex items-center gap-8 text-[12.5px] text-[#6b7280]">
              <span>Interés financiación ({tasaFinanciacionPct}% mens.)</span>
              <span className="w-28 text-right">{formatMontoMoneda(interesFinanciacion, moneda)}</span>
            </div>
          )}
          <div className="h-px w-48 bg-[#edeef1] my-1" />
          <div className="flex items-center gap-8">
            <span className="text-[13px] font-bold">Total a cobrar</span>
            <span className="text-[18px] font-extrabold text-[#E8650A] w-28 text-right">{formatMontoMoneda(totalACobrar, moneda)}</span>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={() => router.back()} disabled={loading}>Cancelar</Button>
        <Button onClick={guardar} loading={loading}>Guardar presupuesto</Button>
      </div>
    </div>
  )
}
