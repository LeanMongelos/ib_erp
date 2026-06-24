'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatMontoMoneda, etiquetaMoneda, type MonedaDocumento } from '@/lib/moneda'
import { validarMonedaDocumentoCliente } from '@/lib/moneda-documento-client'
import { MonedaDocumentoPanel } from '@/components/fiscal/MonedaDocumentoPanel'
import { calcularTotales, resumenIvaPorAlicuota } from '@/lib/documentos'
import { formatCondicionPago } from '@/lib/cobranzas/plazos'
import { calcularInteresFinanciacion } from '@/lib/cobranzas/financiacion'
import type { PresetPlazoKey } from '@/lib/cobranzas/plazos'
import {
  PlazosFinanciacionPanel,
  estadoInicialPlazos,
  plazosDesdeEstado,
} from '@/components/cobranzas/PlazosFinanciacionPanel'
import { PresupuestoFacturacionPicker } from '@/components/facturacion/PresupuestoFacturacionPicker'
import { AlicuotaSelector } from '@/components/fiscal/AlicuotaSelector'
import { useAlicuotasIva } from '@/components/fiscal/useAlicuotasIva'
import { resolverPorcentajeCliente } from '@/lib/iva/sugerir-alicuota'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'
import { InventarioPicker, type InventarioOption } from '@/components/inventario/InventarioPicker'
import { ClienteCombobox } from '@/components/clientes/ClienteCombobox'
import { Select } from '@/components/ui/select'
import { SucursalRapidaModal, type SucursalOption } from '@/components/clientes/SucursalRapidaModal'
import { AfipEmisionAlerta } from '@/components/facturacion/AfipEmisionAlerta'
import { validarEmisionAfip } from '@/lib/afip/validar-emision'
import { validarSucursalesInstalacionEquipoCliente } from '@/lib/facturas/validar-sucursal-equipo-client'

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
  sucursalInstalacionId?: string
}

interface ClienteOption {
  id: string
  nombre: string
  condicionIva?: string | null
  alicuotaIva?: { porcentaje: number } | null
}

interface PresupuestoPrefill {
  id: string
  numero: string
  clienteId: string
  otId?: string | null
  emisorId?: string | null
  alicuotaIvaPct?: number
  condicionPago?: string | null
  moneda?: string
  cotizacionUsd?: number | null
  formaPago?: string | null
  tasaFinanciacionPct?: number
  interesFinanciacion?: number
  observaciones?: string | null
  items: {
    id: string
    descripcion: string
    cantidad: number
    precioUnit: number
    alicuotaIvaPct?: number | null
    inventarioId?: string | null
    codigo?: string | null
    numeroSerie?: string | null
    proximoPreventivo?: string | null
    inventario?: {
      id: string
      tipoArticulo: string
      esSerializado: boolean
      requierePreventivo: boolean
      intervaloPreventivoDias?: number | null
    } | null
  }[]
  cliente: { nombre: string }
}

interface Props {
  clientes: ClienteOption[]
  emisores: {
    id: string
    razonSocial: string
    predeterminado?: boolean
    ambiente: 'HOMOLOGACION' | 'PRODUCCION'
    certificadoPath?: string | null
    clavePrivadaPath?: string | null
  }[]
  otPrefill: any | null
  presupuestoPrefill?: PresupuestoPrefill | null
  plantillaFactura: { id: string | null; nombre: string; origen: string }
}

export function NuevaFacturaForm({
  clientes,
  emisores,
  otPrefill,
  presupuestoPrefill,
  plantillaFactura,
}: Props) {
  const router = useRouter()
  const { alicuotas, defaultPct } = useAlicuotasIva()
  const plazoInicial = estadoInicialPlazos(
    presupuestoPrefill?.condicionPago,
    presupuestoPrefill?.tasaFinanciacionPct ?? 0,
  )

  const defEmisor = emisores.find((e) => e.predeterminado)?.id ?? emisores[0]?.id ?? ''
  const [clienteId, setClienteId] = useState(
    presupuestoPrefill?.clienteId ?? otPrefill?.clienteId ?? '',
  )
  const [emisorId, setEmisorId] = useState(presupuestoPrefill?.emisorId || defEmisor)
  const [tipo, setTipo] = useState<'A' | 'B' | 'C'>('B')
  const [alicuotaDocumentoPct, setAlicuotaDocumentoPct] = useState(
    presupuestoPrefill?.alicuotaIvaPct ?? 21,
  )
  const [items, setItems] = useState<ItemRow[]>(() => {
    if (presupuestoPrefill?.items?.length) {
      return presupuestoPrefill.items.map((i) => ({
        id: i.id,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnit: i.precioUnit,
        alicuotaIvaPct: i.alicuotaIvaPct ?? undefined,
        inventarioId: i.inventarioId ?? undefined,
        codigo: i.codigo ?? undefined,
        tipoArticulo: i.inventario?.tipoArticulo,
        esSerializado: i.inventario?.esSerializado,
        numeroSerie: i.numeroSerie ?? undefined,
        proximoPreventivo: i.proximoPreventivo
          ? new Date(i.proximoPreventivo).toISOString().slice(0, 10)
          : undefined,
      }))
    }
    return [{ id: '1', descripcion: '', cantidad: 1, precioUnit: 0 }]
  })
  const [loading, setLoading] = useState(false)
  const [presetPlazo, setPresetPlazo] = useState<PresetPlazoKey | 'custom'>(plazoInicial.presetPlazo)
  const [sucursalesCliente, setSucursalesCliente] = useState<SucursalOption[]>([])
  const [sucursalModalAbierto, setSucursalModalAbierto] = useState(false)
  const [sucursalModalItemIdx, setSucursalModalItemIdx] = useState<number | null>(null)
  const [plazosCustom, setPlazosCustom] = useState(plazoInicial.plazosCustom)
  const [tasaFinanciacionPct, setTasaFinanciacionPct] = useState(plazoInicial.tasaFinanciacionPct)
  const [moneda, setMoneda] = useState<MonedaDocumento>(
    (presupuestoPrefill?.moneda as MonedaDocumento) ?? 'ARS',
  )
  const [cotizacionUsd, setCotizacionUsd] = useState<number | null>(
    presupuestoPrefill?.cotizacionUsd ?? null,
  )

  const plazosActivos = useMemo(
    () => plazosDesdeEstado(presetPlazo, plazosCustom),
    [presetPlazo, plazosCustom],
  )

  // Pre-cargar repuestos de la OT (si no hay presupuesto)
  useEffect(() => {
    if (presupuestoPrefill?.items?.length) return
    if (otPrefill?.repuestos?.length) {
      setItems(
        otPrefill.repuestos.map((r: any) => ({
          id: r.id,
          descripcion: r.descripcion,
          cantidad: r.cantidad,
          precioUnit: r.precioUnit,
        })),
      )
    }
  }, [otPrefill, presupuestoPrefill])

  useEffect(() => {
    if (presupuestoPrefill?.alicuotaIvaPct != null) return
    setAlicuotaDocumentoPct(defaultPct)
  }, [defaultPct, presupuestoPrefill?.alicuotaIvaPct])

  useEffect(() => {
    if (presupuestoPrefill) return
    if (!clienteId) return
    const c = clientes.find((x) => x.id === clienteId)
    setAlicuotaDocumentoPct(resolverPorcentajeCliente(c, defaultPct))
  }, [clienteId, clientes, defaultPct, presupuestoPrefill])

  const recargarSucursales = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/clientes/${id}/sucursales`, { credentials: 'include' })
      if (res.ok) setSucursalesCliente(await res.json())
      else setSucursalesCliente([])
    } catch {
      setSucursalesCliente([])
    }
  }, [])

  useEffect(() => {
    if (!clienteId) {
      setSucursalesCliente([])
      return
    }
    recargarSucursales(clienteId)
  }, [clienteId, recargarSucursales])

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

  const interesFinanciacion = useMemo(
    () => calcularInteresFinanciacion(totales.total, plazosActivos, tasaFinanciacionPct),
    [totales.total, plazosActivos, tasaFinanciacionPct],
  )

  const totalACobrar = totales.total + interesFinanciacion

  const emisorSeleccionado = emisores.find((e) => e.id === emisorId) ?? null
  const errorEmisionAfip = validarEmisionAfip(emisorSeleccionado)

  function addItem() {
    setItems([...items, { id: `new-${Date.now()}`, descripcion: '', cantidad: 1, precioUnit: 0 }])
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ItemRow, value: string | number | undefined) {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }

  async function guardar(emitirAfip: boolean) {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return }
    if (items.every((i) => !i.descripcion)) { toast.error('Agregá al menos un ítem'); return }

    const errSucursal = validarSucursalesInstalacionEquipoCliente(
      items.filter((i) => i.descripcion),
    )
    if (errSucursal) {
      toast.error(errSucursal)
      return
    }

    const errMoneda = validarMonedaDocumentoCliente(moneda, cotizacionUsd)
    if (errMoneda) {
      toast.error(errMoneda)
      return
    }

    if (emitirAfip) {
      const errAfip = validarEmisionAfip(emisorSeleccionado)
      if (errAfip) {
        toast.error(errAfip)
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          emisorId: emisorId || null,
          tipo,
          estado: 'BORRADOR',
          otId: otPrefill?.id ?? presupuestoPrefill?.otId ?? null,
          presupuestoId: presupuestoPrefill?.id ?? null,
          plantillaId: plantillaFactura.id ?? undefined,
          observaciones: presupuestoPrefill?.observaciones ?? undefined,
          condicionPago:
            plazosActivos.length > 0 ? formatCondicionPago(plazosActivos) : undefined,
          alicuotaIvaPct: alicuotaDocumentoPct,
          moneda,
          cotizacionUsd: moneda === 'USD' ? cotizacionUsd : null,
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
            sucursalInstalacionId: i.sucursalInstalacionId || null,
          })),
          ...(plazosActivos.length > 0 ? { plazosCobranza: plazosActivos } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar la factura'))

      if (emitirAfip) {
        const emitRes = await fetch(`/api/facturas/${data.id}/emitir`, { method: 'POST' })
        const emitData = await emitRes.json().catch(() => ({}))
        if (!emitRes.ok) throw new Error(mensajeErrorJson(emitData, 'No se pudo emitir el comprobante en AFIP'))
        toast.success(emitData.simulado ? 'CAE simulado (sin certificado)' : 'Factura emitida en AFIP')
      } else {
        toast.success('Borrador guardado')
      }
      router.push('/facturacion')
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar la factura'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">
      {!presupuestoPrefill && (
        <PresupuestoFacturacionPicker clienteId={clienteId || undefined} />
      )}

      {presupuestoPrefill && (
        <div className="bg-[#FFF7ED] border border-[#FDBA74] rounded-[10px] px-4 py-3">
          <p className="text-[13px] font-bold text-[#9A3412]">
            Facturando presupuesto {presupuestoPrefill.numero}
          </p>
          <p className="text-[12px] text-[#C2410C] mt-0.5">
            Cliente, ítems y montos cargados desde el presupuesto aprobado. Revisá y emití cuando esté listo.
          </p>
        </div>
      )}

      {/* Datos generales */}
      <Card>
        <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <h3 className="text-[13.5px] font-bold text-[#1f242c]">Datos del comprobante</h3>
          <div className="flex items-start gap-2 bg-[#FFFBF5] border border-[#FFE4CC] rounded-[9px] px-3 py-2 max-w-md">
            <FileText size={15} className="text-[#E8650A] shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-[#92400E] uppercase tracking-wide">Modelo de impresión</p>
              <p className="text-[12.5px] font-semibold text-[#1f242c]">{plantillaFactura.nombre}</p>
              <p className="text-[11px] text-[#6b7280]">
                Configurado en Plantillas de impresión. El PDF usará este diseño al emitir.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ClienteCombobox
            value={clienteId}
            onChange={setClienteId}
            initialOptions={clientes}
          />

          <Select
            label="Emisor / CUIT"
            value={emisorId}
            onChange={(e) => setEmisorId(e.target.value)}
            options={emisores.map((e) => ({ value: e.id, label: e.razonSocial }))}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#5b626d] tracking-wide uppercase">Tipo de comprobante</label>
            <div className="flex gap-2">
              {(['A', 'B', 'C'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex-1 py-2.5 rounded-[9px] text-[14px] font-bold border transition-colors ${
                    tipo === t
                      ? 'bg-[#E8650A] text-white border-[#E8650A]'
                      : 'bg-white text-[#3a4150] border-[#e4e7eb] hover:border-[#E8650A]'
                  }`}
                >
                  Tipo {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 col-span-2">
            <AlicuotaSelector
              label="Alícuota IVA del comprobante"
              value={alicuotaDocumentoPct}
              onChange={setAlicuotaDocumentoPct}
              alicuotas={alicuotas}
            />
            <p className="text-[11px] text-[#9aa1ab]">
              Según cliente y tipo de operación. Podés usar otra tasa por ítem en la tabla.
            </p>
          </div>
          <MonedaDocumentoPanel
            moneda={moneda}
            onMonedaChange={setMoneda}
            cotizacionUsd={cotizacionUsd}
            onCotizacionUsdChange={setCotizacionUsd}
            totalDocumento={totalACobrar}
          />
        </div>

        <div className="mt-3">
          <AfipEmisionAlerta emisor={emisorSeleccionado} />
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
          />
        </div>

        {otPrefill && !presupuestoPrefill && (
          <div className="mt-3 text-[12.5px] text-[#6b7280] bg-[#f4f6f9] rounded-[8px] px-3 py-2">
            OT vinculada: <span className="font-bold text-[#E8650A]">{otPrefill.numero}</span>
          </div>
        )}
        {presupuestoPrefill && (
          <div className="mt-3 text-[12.5px] text-[#6b7280] bg-[#f4f6f9] rounded-[8px] px-3 py-2">
            Presupuesto: <span className="font-bold text-[#E8650A]">{presupuestoPrefill.numero}</span>
            {' · '}
            {presupuestoPrefill.cliente.nombre}
          </div>
        )}
      </Card>

      {/* Ítems */}
      <Card padding={false}>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle>Ítems de la factura</CardTitle>
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
                    `Moneda de la factura cambiada a ${etiquetaMoneda(itemMoneda)} para coincidir con «${item.nombre}»`,
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
                    cantidad: esEquipo ? 1 : 1,
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
            <button onClick={addItem} className="text-[11.5px] text-[#E8650A] font-bold hover:underline whitespace-nowrap">
              + Ítem manual
            </button>
          </div>
        </CardHeader>

        <table className="w-full">
          <thead>
            <tr>
              {['Descripción', 'Cant.', 'Precio unit.', 'IVA %', 'Serie / Preventivo', 'Subtotal', ''].map((h, i) => (
                <th key={i} className={`px-5 py-2.5 text-[10px] font-bold text-[#8a909a] tracking-[0.5px] uppercase border-b border-[#f0f1f4] ${i > 0 && i < 6 ? 'text-right' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id}>
                <td className="px-5 py-3 border-b border-[#f4f5f7]">
                  <input
                    value={item.descripcion}
                    onChange={(e) => updateItem(i, 'descripcion', e.target.value)}
                    placeholder="Descripción del ítem…"
                    className="text-[12.5px] text-[#3a4150] bg-transparent border-none outline-none w-full"
                  />
                  {item.codigo && <p className="text-[10px] text-[#9aa1ab] font-mono mt-0.5">SKU {item.codigo}</p>}
                  {item.tipoArticulo === 'EQUIPO' && (
                    <p className="text-[10px] text-[#E8650A] font-semibold mt-0.5">Equipo → cliente + preventivo</p>
                  )}
                  {item.tipoArticulo === 'EQUIPO' && clienteId && (
                    <div className="mt-2 p-2 bg-[#FFF7ED] border border-[#FDBA74]/60 rounded-md space-y-1.5">
                      <label className="text-[10px] font-bold text-[#9A3412] uppercase tracking-wide">
                        Sucursal de instalación *
                      </label>
                      {sucursalesCliente.length === 0 ? (
                        <p className="text-[10px] text-[#C2410C]">
                          Este cliente no tiene sucursales. Creá una para ubicar el equipo en el mapa.
                        </p>
                      ) : (
                        <select
                          value={item.sucursalInstalacionId ?? ''}
                          onChange={(e) => updateItem(i, 'sucursalInstalacionId', e.target.value || undefined)}
                          className="w-full text-[11px] border border-[#e4e7eb] rounded px-2 py-1.5 bg-white"
                        >
                          <option value="">Seleccionar sede…</option>
                          {sucursalesCliente.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nombre}
                              {s.ciudad ? ` · ${s.ciudad}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSucursalModalItemIdx(i)
                          setSucursalModalAbierto(true)
                        }}
                        className="text-[10px] font-bold text-[#E8650A] hover:underline"
                      >
                        + Cargar sucursal nueva
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 border-b border-[#f4f5f7] text-right">
                  <input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    disabled={item.tipoArticulo === 'EQUIPO'}
                    onChange={(e) => updateItem(i, 'cantidad', Number(e.target.value))}
                    className="text-[12.5px] text-[#3a4150] bg-transparent border-none outline-none w-14 text-right disabled:opacity-50"
                  />
                </td>
                <td className="px-5 py-3 border-b border-[#f4f5f7] text-right">
                  <input
                    type="number"
                    min={0}
                    value={item.precioUnit}
                    onChange={(e) => updateItem(i, 'precioUnit', Number(e.target.value))}
                    className="text-[12.5px] text-[#6b7280] bg-transparent border-none outline-none w-28 text-right"
                  />
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
                <td className="px-5 py-3 border-b border-[#f4f5f7] text-right text-[12.5px] font-bold text-[#1f242c]">
                  {formatMontoMoneda(item.cantidad * item.precioUnit, moneda)}
                </td>
                <td className="px-5 py-3 border-b border-[#f4f5f7] text-right">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="px-5 py-4 border-t border-[#f0f1f4] flex flex-col items-end gap-2">
          <div className="flex items-center gap-8 text-[12.5px] text-[#6b7280]">
            <span>Subtotal</span>
            <span className="font-semibold text-[#3a4150] w-28 text-right">{formatMontoMoneda(totales.subtotal, moneda)}</span>
          </div>
          {resumenIva.map((r) => (
            <div key={r.porcentaje} className="flex items-center gap-8 text-[12.5px] text-[#6b7280]">
              <span>IVA ({r.porcentaje}%)</span>
              <span className="font-semibold text-[#3a4150] w-28 text-right">{formatMontoMoneda(r.iva, moneda)}</span>
            </div>
          ))}
          {interesFinanciacion > 0 && (
            <div className="flex items-center gap-8 text-[12.5px] text-[#6b7280]">
              <span>Interés financiación ({tasaFinanciacionPct}% mens.)</span>
              <span className="font-semibold text-[#3a4150] w-28 text-right">{formatMontoMoneda(interesFinanciacion, moneda)}</span>
            </div>
          )}
          <div className="h-px w-48 bg-[#edeef1] my-1" />
          <div className="flex items-center gap-8">
            <span className="text-[13px] font-bold text-[#1f242c]">
              {interesFinanciacion > 0 ? 'Total a cobrar' : 'Total'}
            </span>
            <span className="text-[18px] font-extrabold text-[#E8650A] w-28 text-right">
              {formatMontoMoneda(interesFinanciacion > 0 ? totalACobrar : totales.total, moneda)}
            </span>
          </div>
        </div>
      </Card>

      {/* Botones */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="outline" onClick={() => guardar(false)} loading={loading}>
          Guardar borrador
        </Button>
        <Button
          variant="primary"
          onClick={() => guardar(true)}
          loading={loading}
          disabled={Boolean(errorEmisionAfip)}
          title={errorEmisionAfip ?? undefined}
        >
          Crear y emitir AFIP
        </Button>
      </div>

      {clienteId && (
        <SucursalRapidaModal
          open={sucursalModalAbierto}
          clienteId={clienteId}
          clienteNombre={clientes.find((c) => c.id === clienteId)?.nombre}
          onClose={() => {
            setSucursalModalAbierto(false)
            setSucursalModalItemIdx(null)
          }}
          onCreated={(sucursal) => {
            setSucursalesCliente((prev) => {
              if (prev.some((s) => s.id === sucursal.id)) return prev
              return [...prev, sucursal].sort((a, b) => a.nombre.localeCompare(b.nombre))
            })
            if (sucursalModalItemIdx != null) {
              updateItem(sucursalModalItemIdx, 'sucursalInstalacionId', sucursal.id)
            }
          }}
        />
      )}
    </div>
  )
}
