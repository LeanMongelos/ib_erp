'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Package, Plus, RefreshCw, Truck, ShoppingCart } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ProveedorCombobox } from '@/components/proveedores/ProveedorCombobox'
import { OrdenCompraFormModal } from '@/components/compras/OrdenCompraFormModal'
import { FacturaCompraFormModal } from '@/components/compras/FacturaCompraFormModal'
import { LibroComprasPanel } from '@/components/compras/LibroComprasPanel'
import { PagosProveedorPanel } from '@/components/compras/PagosProveedorPanel'
import { AlertasComprasBanner } from '@/components/compras/AlertasComprasBanner'
import { CuentaCorrientePanel } from '@/components/compras/CuentaCorrientePanel'
import { formatFecha, formatMonto } from '@/lib/utils'
import { formatMontoMoneda } from '@/lib/compras/moneda-compra'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'
import { TIPO_COMPRA_PROVEEDOR } from '@/lib/form-options'
import type { TipoCompraProveedor, TipoFacturaCompra } from '@/types'

interface OCItem {
  id: string
  descripcion: string
  cantidad: number
  cantidadRecibida: number
  precioUnit: number
  subtotal: number
  inventarioId?: string | null
  depositoDestinoId?: string | null
  inventario?: {
    id: string
    nombre?: string
    modoTrazabilidad?: string
    esSerializado?: boolean
  } | null
}

interface OrdenCompra {
  id: string
  numero: string
  estado: string
  subtotal: number
  total: number
  moneda?: string
  creadoEn: string
  observaciones?: string | null
  rechazadoMotivo?: string | null
  clasificacionOrigen?: string | null
  justificacion?: string | null
  depositoDestinoDefaultId?: string | null
  depositoDestinoDefault?: { id: string; nombre: string } | null
  solicitante?: { nombre: string } | null
  proveedor?: { id: string; razonSocial: string; tipoCompra?: TipoCompraProveedor }
  creadoPor?: { nombre: string } | null
  aprobadoPor?: { nombre: string } | null
  rechazadoPor?: { nombre: string } | null
  items: OCItem[]
}

interface PlantillaOC {
  id: string
  nombre: string
  clasificacionOrigen: string
  activa: boolean
  recordatorioDiaMes?: number | null
  proveedor?: { razonSocial: string }
}

interface Faltante {
  id: string
  nombre: string
  sku?: string | null
  stock: number
  stockMinimo: number
  faltante: number
  ultimoProveedor?: { id: string; razonSocial: string } | null
}

interface Proveedor {
  id: string
  razonSocial: string
  tipoCompra?: TipoCompraProveedor
}

interface TipoComprobanteOption {
  id: string
  codigoAfip: number
  letra: string
  descripcion: string
}

interface VencimientoPago {
  id: string
  fecha: string
  monto: number
  saldo: number
  pagado: boolean
}

interface FacturaCompra {
  id: string
  numero: string
  tipo: TipoFacturaCompra
  estado: string
  fecha: string
  neto: number
  iva: number
  total: number
  moneda?: string
  recepcionCompleta: boolean
  fcSinRecepcion: boolean
  proveedor?: { id: string; razonSocial: string; tipoCompra?: TipoCompraProveedor }
  ordenCompra?: { id: string; numero: string; estado: string } | null
  vencimientos: VencimientoPago[]
}

const ESTADO_OC: Record<string, { label: string; cls: string }> = {
  BORRADOR:               { label: 'Borrador',              cls: 'bg-gray-100 text-gray-600' },
  PENDIENTE_APROBACION:   { label: 'Pendiente aprobación',  cls: 'bg-amber-100 text-amber-800' },
  APROBADA:               { label: 'Aprobada',              cls: 'bg-green-100 text-green-700' },
  RECHAZADA:              { label: 'Rechazada',             cls: 'bg-red-100 text-red-700' },
  ENVIADA:                { label: 'Enviada',               cls: 'bg-blue-100 text-blue-700' },
  PARCIAL:                { label: 'Parcial',               cls: 'bg-orange-100 text-orange-700' },
  RECIBIDA:               { label: 'Recibida',              cls: 'bg-green-100 text-green-700' },
  CANCELADA:              { label: 'Cancelada',             cls: 'bg-red-100 text-red-600' },
}

const FILTRO_ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'PENDIENTE_APROBACION', label: 'Pendiente aprobación' },
  { value: 'APROBADA', label: 'Aprobada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'PARCIAL', label: 'Parcial' },
  { value: 'RECIBIDA', label: 'Recibida' },
]

const FILTRO_TIPO = [{ value: '', label: 'Todos los tipos' }, ...TIPO_COMPRA_PROVEEDOR]

const ESTADO_FC: Record<string, { label: string; cls: string }> = {
  BORRADOR:    { label: 'Borrador',    cls: 'bg-gray-100 text-gray-600' },
  REGISTRADA:  { label: 'Registrada',  cls: 'bg-green-100 text-green-700' },
  ANULADA:     { label: 'Anulada',     cls: 'bg-red-100 text-red-700' },
}

const FILTRO_ESTADOS_FC = [
  { value: '', label: 'Todos los estados' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'REGISTRADA', label: 'Registrada' },
  { value: 'ANULADA', label: 'Anulada' },
]

const FILTRO_TIPO_FC = [
  { value: '', label: 'Todos los tipos' },
  { value: 'REMITO', label: 'Remito' },
  { value: 'CONCEPTOS', label: 'Conceptos' },
]

export function ComprasManager({
  proveedores,
  tiposComprobante = [],
  inicialOrdenes = [],
  inicialFaltantes = [],
  inicialFacturas = [],
  usuarios = [],
  depositos = [],
  plantillasOc = [],
  actorId,
  cotizacionUsdDefault,
}: {
  proveedores: Proveedor[]
  tiposComprobante?: TipoComprobanteOption[]
  inicialOrdenes?: OrdenCompra[]
  inicialFaltantes?: Faltante[]
  inicialFacturas?: FacturaCompra[]
  usuarios?: { id: string; nombre: string }[]
  depositos?: { id: string; nombre: string }[]
  plantillasOc?: PlantillaOC[]
  actorId?: string
  cotizacionUsdDefault?: number | null
}) {
  const router = useRouter()
  const puedeRecibir = useCan('compras.receive')
  const puedeAprobar = useCan('compras.approve')
  const puedeCrear = useCan('compras.create')
  const puedeInvoice = useCan('compras.invoice')
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>(inicialOrdenes)
  const [facturas, setFacturas] = useState<FacturaCompra[]>(inicialFacturas)
  const [faltantes, setFaltantes] = useState<Faltante[]>(inicialFaltantes)
  const [loading, setLoading] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [proveedorId, setProveedorId] = useState('')
  const [recibir, setRecibir] = useState<OrdenCompra | null>(null)
  const [formOc, setFormOc] = useState<null | 'nueva' | string>(null)
  const [rechazarOc, setRechazarOc] = useState<OrdenCompra | null>(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroEstadoFc, setFiltroEstadoFc] = useState('')
  const [filtroTipoFc, setFiltroTipoFc] = useState('')
  const [filtroProveedorFc, setFiltroProveedorFc] = useState('')
  const [vista, setVista] = useState<'todas' | 'aprobacion'>('todas')
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'oc' | 'facturas' | 'libro' | 'pagos' | 'cuenta'>('oc')

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'facturas' || t === 'libro' || t === 'pagos' || t === 'cuenta' || t === 'oc') {
      setTab(t)
    }
    const ocId = searchParams.get('oc')
    if (ocId) {
      setTab('oc')
      setFormOc(ocId)
    }
  }, [searchParams])
  const [formFc, setFormFc] = useState<null | 'nueva' | string | { desdeOc: OrdenCompra }>(null)

  const pendientesAprobacion = useMemo(
    () => ordenes.filter((o) => o.estado === 'PENDIENTE_APROBACION'),
    [ordenes],
  )

  const ordenesVisibles = useMemo(() => {
    let list = vista === 'aprobacion'
      ? pendientesAprobacion
      : ordenes
    if (filtroEstado && vista !== 'aprobacion') {
      list = list.filter((o) => o.estado === filtroEstado)
    }
    if (filtroTipo) {
      list = list.filter((o) => {
        const t = o.proveedor?.tipoCompra ?? 'AMBOS'
        return t === filtroTipo || (filtroTipo !== 'AMBOS' && t === 'AMBOS')
      })
    }
    if (filtroProveedor) {
      list = list.filter((o) => o.proveedor?.id === filtroProveedor)
    }
    return list
  }, [ordenes, vista, filtroEstado, filtroTipo, filtroProveedor, pendientesAprobacion])

  const facturasVisibles = useMemo(() => {
    let list = facturas
    if (filtroEstadoFc) list = list.filter((f) => f.estado === filtroEstadoFc)
    if (filtroTipoFc) list = list.filter((f) => f.tipo === filtroTipoFc)
    if (filtroProveedorFc) list = list.filter((f) => f.proveedor?.id === filtroProveedorFc)
    return list
  }, [facturas, filtroEstadoFc, filtroTipoFc, filtroProveedorFc])

  function saldoAp(fc: FacturaCompra) {
    return fc.vencimientos?.filter((v) => !v.pagado).reduce((a, v) => a + v.saldo, 0) ?? 0
  }

  async function cargarFacturas() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroEstadoFc) params.set('estado', filtroEstadoFc)
      if (filtroTipoFc) params.set('tipo', filtroTipoFc)
      if (filtroProveedorFc) params.set('proveedorId', filtroProveedorFc)
      const qs = params.toString()
      const res = await fetch(qs ? `/api/compras/facturas?${qs}` : '/api/compras/facturas')
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudieron cargar las facturas'))
      if (!Array.isArray(data)) throw new Error('Respuesta inválida')
      setFacturas(data)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudieron cargar las facturas'))
      setFacturas([])
    } finally {
      setLoading(false)
    }
  }

  async function registrarFc(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/compras/facturas/${id}/registrar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(mensajeErrorJson(data, 'No se pudo registrar la factura'))
      }
      toast.success('Factura registrada')
      await cargarFacturas()
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo registrar la factura'))
    } finally {
      setLoading(false)
    }
  }

  async function anularFc(id: string) {
    if (!confirm('¿Anular esta factura de compra?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/compras/facturas/${id}/anular`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(mensajeErrorJson(data, 'No se pudo anular la factura'))
      }
      toast.success('Factura anulada')
      await cargarFacturas()
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo anular la factura'))
    } finally {
      setLoading(false)
    }
  }

  async function facturaDesdeOc(oc: OrdenCompra) {
    setLoading(true)
    try {
      const res = await fetch('/api/compras/facturas/desde-oc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordenCompraId: oc.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo crear la factura'))
      toast.success(`Factura ${data.numero} creada en borrador`)
      setTab('facturas')
      await cargarFacturas()
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo crear la factura desde la OC'))
    } finally {
      setLoading(false)
    }
  }

  async function cargar() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroEstado) params.set('estado', filtroEstado)
      if (filtroTipo) params.set('tipoCompra', filtroTipo)
      if (filtroProveedor) params.set('proveedorId', filtroProveedor)
      const qs = params.toString()

      const [resOc, resFalt] = await Promise.all([
        fetch(qs ? `/api/ordenes-compra?${qs}` : '/api/ordenes-compra'),
        fetch('/api/inventario/faltantes'),
      ])
      const ocs = await resOc.json()
      const falt = await resFalt.json()

      if (!resOc.ok) throw new Error(mensajeErrorJson(ocs, 'No se pudieron cargar las órdenes de compra'))
      if (!resFalt.ok) throw new Error(mensajeErrorJson(falt, 'No se pudieron cargar los faltantes de stock'))
      if (!Array.isArray(ocs)) throw new Error('Respuesta inválida de órdenes de compra')
      if (!Array.isArray(falt)) throw new Error('Respuesta inválida de faltantes')

      setOrdenes(ocs)
      setFaltantes(falt)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudieron cargar las órdenes de compra'))
      setOrdenes([])
      setFaltantes([])
    } finally {
      setLoading(false)
    }
  }

  async function enviarAprobacion(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/ordenes-compra/${id}/enviar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(mensajeErrorJson(data, 'No se pudo enviar a aprobación'))
      }
      toast.success('OC enviada a aprobación')
      await cargar()
      router.refresh()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo enviar a aprobación'))
    } finally {
      setLoading(false)
    }
  }

  async function aprobarOc(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/ordenes-compra/${id}/aprobar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(mensajeErrorJson(data, 'No se pudo aprobar la OC'))
      }
      toast.success('OC aprobada')
      await cargar()
      router.refresh()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo aprobar la OC'))
    } finally {
      setLoading(false)
    }
  }

  async function generarOC(proveedorOverride?: string) {
    const prov = proveedorOverride ?? proveedorId
    if (!prov) { toast.error('Seleccioná un proveedor'); return }
    setGenerando(true)
    try {
      const res = await fetch('/api/inventario/generar-oc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedorId: prov }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo generar la orden de compra'))
      toast.success(`OC ${data.numero} generada`)
      setProveedorId('')
      cargar()
      router.refresh()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo generar la orden de compra'))
    } finally {
      setGenerando(false)
    }
  }

  async function usarPlantilla(plantillaId: string) {
    if (!puedeCrear) return
    setGenerando(true)
    try {
      const res = await fetch('/api/ordenes-compra/desde-plantilla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantillaId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo crear OC desde plantilla'))
      toast.success(`OC ${data.numero} creada desde plantilla`)
      cargar()
      router.replace('/compras?tab=oc')
      router.refresh()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo crear OC desde plantilla'))
    } finally {
      setGenerando(false)
    }
  }

  useEffect(() => {
    const plantillaId = searchParams.get('plantilla')
    if (plantillaId && puedeCrear) {
      void usarPlantilla(plantillaId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <AlertasComprasBanner
        onNavigateOc={() => setTab('oc')}
        onNavigateFacturas={() => { setTab('facturas'); cargarFacturas() }}
        onNavigatePagos={() => setTab('pagos')}
      />
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'oc' as const, label: 'Órdenes de compra' },
          { id: 'facturas' as const, label: 'Facturas de compra' },
          { id: 'pagos' as const, label: 'Pagos' },
          { id: 'cuenta' as const, label: 'Cuenta corriente' },
          { id: 'libro' as const, label: 'Libro de compras' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              if (t.id === 'facturas') cargarFacturas()
            }}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${tab === t.id ? 'bg-[#E8650A] text-white' : 'bg-white text-[#6b7280] border border-[#e4e7eb]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'libro' && <LibroComprasPanel proveedores={proveedores} />}

      {tab === 'cuenta' && <CuentaCorrientePanel proveedores={proveedores} />}

      {tab === 'pagos' && (
        <PagosProveedorPanel
          proveedores={proveedores}
          onPagoRegistrado={() => { cargarFacturas(); router.refresh() }}
        />
      )}

      {tab === 'facturas' && (
        <>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            {puedeInvoice && (
              <Button variant="primary" size="sm" onClick={() => setFormFc('nueva')}>
                <Plus size={14} /> Nueva factura
              </Button>
            )}
            <button type="button" onClick={cargarFacturas} className="text-[12px] text-[#6b7280] hover:text-[#E8650A] inline-flex items-center gap-1">
              <RefreshCw size={13} /> Actualizar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select label="Estado" value={filtroEstadoFc} onChange={(e) => setFiltroEstadoFc(e.target.value)} options={FILTRO_ESTADOS_FC} />
            <Select label="Tipo" value={filtroTipoFc} onChange={(e) => setFiltroTipoFc(e.target.value)} options={FILTRO_TIPO_FC} />
            <ProveedorCombobox value={filtroProveedorFc} onChange={setFiltroProveedorFc} initialOptions={proveedores} label="Proveedor" placeholder="Filtrar…" />
          </div>
          <Card padding={false}>
            {loading ? (
              <p className="p-6 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {['Número', 'Proveedor', 'Tipo', 'Estado', 'Total', 'AP pendiente', 'Fecha', ''].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {facturasVisibles.map((fc, i) => {
                      const st = ESTADO_FC[fc.estado] ?? { label: fc.estado, cls: 'bg-gray-100' }
                      const ap = saldoAp(fc)
                      return (
                        <tr key={fc.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                          <td className="px-5 py-[13px] text-[12.5px] font-bold border-b border-[#f4f5f7]">
                            {fc.numero}
                            {fc.ordenCompra && (
                              <span className="block text-[10.5px] text-[#9aa1ab]">OC {fc.ordenCompra.numero}</span>
                            )}
                          </td>
                          <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{fc.proveedor?.razonSocial ?? '—'}</td>
                          <td className="px-5 py-[13px] text-[12px] border-b border-[#f4f5f7]">{fc.tipo}</td>
                          <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="px-5 py-[13px] text-[12.5px] font-semibold border-b border-[#f4f5f7]">
                            {formatMontoMoneda(fc.total, fc.moneda ?? 'ARS')}
                          </td>
                          <td className="px-5 py-[13px] text-[12px] border-b border-[#f4f5f7]">
                            {fc.estado === 'REGISTRADA' && ap > 0 ? formatMontoMoneda(ap, fc.moneda ?? 'ARS') : '—'}
                          </td>
                          <td className="px-5 py-[13px] text-[12px] text-[#9aa1ab] border-b border-[#f4f5f7]">{formatFecha(fc.fecha)}</td>
                          <td className="px-5 py-[13px] border-b border-[#f4f5f7] text-right">
                            <div className="flex gap-2 justify-end flex-wrap">
                              {puedeInvoice && fc.estado === 'BORRADOR' && (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => setFormFc(fc.id)}>Editar</Button>
                                  <Button variant="primary" size="sm" onClick={() => registrarFc(fc.id)}>Registrar</Button>
                                </>
                              )}
                              {puedeInvoice && fc.estado === 'REGISTRADA' && (
                                <Button variant="outline" size="sm" onClick={() => anularFc(fc.id)}>Anular</Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {facturasVisibles.length === 0 && (
                      <tr><td colSpan={8} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">Sin facturas de compra</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'oc' && faltantes.length > 0 && (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-[13.5px] font-bold text-[#1f242c] flex items-center gap-2">
                <Package size={16} className="text-[#E8650A]" />
                Faltantes de stock ({faltantes.length})
                <Link
                  href="/inventario?bajo=1"
                  className="text-[11px] font-semibold text-[#E8650A] hover:underline ml-1"
                >
                  Ver inventario
                </Link>
              </h3>
              <ul className="mt-2 space-y-2">
                {faltantes.slice(0, 8).map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 text-[12px] text-[#6b7280]">
                    <span className="min-w-0 truncate">
                      {f.nombre} — faltan {f.faltante} u. (stock {f.stock}/{f.stockMinimo})
                      {f.ultimoProveedor && (
                        <span className="text-[#9aa1ab]"> · {f.ultimoProveedor.razonSocial}</span>
                      )}
                    </span>
                    {puedeCrear && f.ultimoProveedor && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0 h-7 text-[11px]"
                        loading={generando}
                        onClick={() => generarOC(f.ultimoProveedor!.id)}
                      >
                        <ShoppingCart size={12} />
                        OC
                      </Button>
                    )}
                  </li>
                ))}
                {faltantes.length > 8 && (
                  <li className="text-[11px] text-[#9aa1ab]">+{faltantes.length - 8} más…</li>
                )}
              </ul>
            </div>
            {puedeCrear && (
              <div className="flex items-end gap-2 flex-shrink-0">
                <ProveedorCombobox
                  value={proveedorId}
                  onChange={setProveedorId}
                  initialOptions={proveedores}
                  tipoCompraFilter="REMITO"
                  label="Proveedor"
                  className="min-w-[200px]"
                />
                <Button variant="primary" size="sm" onClick={() => generarOC()} loading={generando}>
                  Generar OC
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === 'oc' && plantillasOc.length > 0 && (
        <Card className="p-4">
          <p className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide mb-2">Plantillas OC</p>
          <div className="flex flex-wrap gap-2">
            {plantillasOc.filter((p) => p.activa).map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                loading={generando}
                disabled={!puedeCrear}
                onClick={() => usarPlantilla(p.id)}
              >
                Usar: {p.nombre}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {tab === 'oc' && (
        <>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVista('todas')}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${vista === 'todas' ? 'bg-[#1f242c] text-white' : 'bg-white text-[#6b7280] border border-[#e4e7eb]'}`}
          >
            Todas ({ordenes.length})
          </button>
          {puedeAprobar && (
            <button
              type="button"
              onClick={() => setVista('aprobacion')}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${vista === 'aprobacion' ? 'bg-amber-600 text-white' : 'bg-white text-[#6b7280] border border-[#e4e7eb]'}`}
            >
              Pendientes ({pendientesAprobacion.length})
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {puedeCrear && (
            <Button variant="primary" size="sm" onClick={() => setFormOc('nueva')}>
              <Plus size={14} /> Nueva OC manual
            </Button>
          )}
          <button type="button" onClick={cargar} className="text-[12px] text-[#6b7280] hover:text-[#E8650A] inline-flex items-center gap-1">
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>
      </div>

      {vista === 'todas' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select label="Estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} options={FILTRO_ESTADOS} />
          <Select label="Tipo proveedor" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} options={FILTRO_TIPO} />
          <ProveedorCombobox
            value={filtroProveedor}
            onChange={setFiltroProveedor}
            initialOptions={proveedores}
            label="Proveedor"
            placeholder="Filtrar por proveedor…"
          />
        </div>
      )}

      <Card padding={false}>
        {loading ? (
          <p className="p-6 text-[12.5px] text-[#9aa1ab]">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Número', 'Proveedor', 'Estado', 'Total', 'Fecha', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold text-[#8a909a] tracking-[0.6px] uppercase border-b border-[#eef0f2]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenesVisibles.map((oc, i) => {
                  const st = ESTADO_OC[oc.estado] ?? { label: oc.estado, cls: 'bg-gray-100 text-gray-600' }
                  const puedeRec = puedeRecibir && ['ENVIADA', 'APROBADA', 'PARCIAL'].includes(oc.estado)
                  const puedeApr = puedeAprobar && oc.estado === 'PENDIENTE_APROBACION'
                  const puedeEnv = puedeCrear && (oc.estado === 'BORRADOR' || oc.estado === 'RECHAZADA')
                  const puedeEdit = puedeCrear && (oc.estado === 'BORRADOR' || oc.estado === 'RECHAZADA')
                  const puedeFc = puedeInvoice && ['APROBADA', 'ENVIADA', 'PARCIAL', 'RECIBIDA'].includes(oc.estado)
                  return (
                    <tr key={oc.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-[13px] text-[12.5px] font-bold text-[#1f242c] border-b border-[#f4f5f7]">
                        {oc.numero}
                        {oc.rechazadoMotivo && (
                          <p className="text-[10.5px] font-normal text-red-600 mt-0.5 truncate max-w-[180px]" title={oc.rechazadoMotivo}>
                            {oc.rechazadoMotivo}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">
                        {oc.proveedor?.razonSocial ?? '—'}
                        {oc.proveedor?.tipoCompra && (
                          <span className="block text-[10.5px] text-[#9aa1ab]">{oc.proveedor.tipoCompra}</span>
                        )}
                      </td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-[13px] text-[12.5px] font-semibold text-[#3a4150] border-b border-[#f4f5f7]">
                        {formatMontoMoneda(oc.total, oc.moneda ?? 'ARS')}
                        {(oc.moneda ?? 'ARS') !== 'ARS' && (
                          <span className="block text-[10px] text-[#9aa1ab]">{oc.moneda}</span>
                        )}
                      </td>
                      <td className="px-5 py-[13px] text-[12px] text-[#9aa1ab] border-b border-[#f4f5f7]">{formatFecha(oc.creadoEn)}</td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7] text-right">
                        <div className="flex gap-2 justify-end flex-wrap">
                          {puedeEdit && (
                            <Button variant="outline" size="sm" disabled={loading} onClick={() => setFormOc(oc.id)}>
                              Editar
                            </Button>
                          )}
                          {puedeEnv && (
                            <Button variant="outline" size="sm" disabled={loading} onClick={() => enviarAprobacion(oc.id)}>
                              Enviar
                            </Button>
                          )}
                          {puedeApr && (
                            <>
                              <Button variant="primary" size="sm" disabled={loading} onClick={() => aprobarOc(oc.id)}>
                                Aprobar
                              </Button>
                              <Button variant="outline" size="sm" disabled={loading} onClick={() => setRechazarOc(oc)}>
                                Rechazar
                              </Button>
                            </>
                          )}
                          {puedeFc && (
                            <Button variant="outline" size="sm" disabled={loading} onClick={() => facturaDesdeOc(oc)}>
                              Registrar factura
                            </Button>
                          )}
                          {puedeRec && (
                            <Button variant="outline" size="sm" onClick={() => setRecibir(oc)}>
                              <Truck size={14} /> Recibir
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {ordenesVisibles.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">Sin órdenes de compra</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
        </>
      )}

      {formOc && (
        <OrdenCompraFormModal
          ocId={formOc === 'nueva' ? undefined : formOc}
          proveedores={proveedores}
          usuarios={usuarios}
          depositos={depositos}
          actorId={actorId}
          cotizacionUsdDefault={cotizacionUsdDefault}
          onClose={() => setFormOc(null)}
          onSaved={() => { setFormOc(null); cargar(); router.refresh() }}
        />
      )}

      {recibir && (
        <RecibirModal
          oc={recibir}
          depositos={depositos}
          onClose={() => setRecibir(null)}
          onDone={() => { setRecibir(null); cargar(); router.refresh() }}
        />
      )}

      {rechazarOc && (
        <RechazarModal
          oc={rechazarOc}
          onClose={() => setRechazarOc(null)}
          onDone={() => { setRechazarOc(null); cargar(); router.refresh() }}
        />
      )}

      {formFc && (
        <FacturaCompraFormModal
          fcId={typeof formFc === 'string' ? (formFc === 'nueva' ? undefined : formFc) : undefined}
          proveedores={proveedores}
          tiposComprobante={tiposComprobante}
          ordenCompraPrefill={
            typeof formFc === 'object' && 'desdeOc' in formFc
              ? { id: formFc.desdeOc.id, numero: formFc.desdeOc.numero, proveedorId: formFc.desdeOc.proveedor?.id ?? '' }
              : undefined
          }
          onClose={() => setFormFc(null)}
          onSaved={() => { setFormFc(null); cargarFacturas(); router.refresh() }}
        />
      )}
    </div>
  )
}

function RechazarModal({ oc, onClose, onDone }: { oc: OrdenCompra; onClose: () => void; onDone: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  async function confirmar() {
    if (motivo.trim().length < 3) { toast.error('Indicá el motivo del rechazo'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/ordenes-compra/${oc.id}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(mensajeErrorJson(data, 'No se pudo rechazar la OC'))
      }
      toast.success('OC rechazada')
      onDone()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo rechazar la OC'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-modal-overlay>
      <div className="bg-white rounded-[14px] w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#eef0f2]">
          <h3 className="text-[14px] font-bold text-[#16181d]">Rechazar {oc.numero}</h3>
        </div>
        <div className="p-5">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            className="w-full border border-[#e4e7eb] rounded-[8px] px-3 py-2 text-[13px]"
            placeholder="Motivo del rechazo…"
          />
        </div>
        <div className="px-5 py-4 border-t border-[#eef0f2] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" onClick={confirmar} loading={loading}>Confirmar rechazo</Button>
        </div>
      </div>
    </div>
  )
}

function RecibirModal({
  oc,
  depositos,
  onClose,
  onDone,
}: {
  oc: OrdenCompra
  depositos: { id: string; nombre: string }[]
  onClose: () => void
  onDone: () => void
}) {
  const defaultDeposito = oc.depositoDestinoDefaultId ?? oc.depositoDestinoDefault?.id ?? depositos[0]?.id ?? ''

  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      oc.items.map((i) => [i.id, Math.max(i.cantidad - i.cantidadRecibida, 0)]),
    ),
  )
  const [depositosLinea, setDepositosLinea] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      oc.items.map((i) => [i.id, i.depositoDestinoId ?? defaultDeposito]),
    ),
  )
  const [ubicaciones, setUbicaciones] = useState<Record<string, string>>({})
  const [unidades, setUnidades] = useState<Record<string, { numeroSerie?: string; lote?: string }[]>>({})
  const [loading, setLoading] = useState(false)

  function trazabilidadActiva(item: OCItem): boolean {
    const modo = item.inventario?.modoTrazabilidad
    return modo != null && modo !== 'NINGUNA'
  }

  function syncUnidades(itemId: string, cantidad: number, item: OCItem) {
    if (!trazabilidadActiva(item)) return
    setUnidades((prev) => {
      const actuales = prev[itemId] ?? []
      const next = Array.from({ length: cantidad }, (_, i) => actuales[i] ?? {})
      return { ...prev, [itemId]: next }
    })
  }

  async function confirmar() {
    const items = oc.items
      .map((item) => {
        const cantidad = cantidades[item.id] ?? 0
        if (cantidad <= 0) return null
        const base: {
          id: string
          cantidad: number
          depositoId?: string
          ubicacionDetalle?: string
          unidades?: { numeroSerie?: string; lote?: string }[]
        } = { id: item.id, cantidad }
        if (item.inventarioId) {
          base.depositoId = depositosLinea[item.id] || defaultDeposito
          if (ubicaciones[item.id]?.trim()) base.ubicacionDetalle = ubicaciones[item.id].trim()
          if (trazabilidadActiva(item)) base.unidades = unidades[item.id] ?? []
        }
        return base
      })
      .filter(Boolean) as Array<{
        id: string
        cantidad: number
        depositoId?: string
        ubicacionDetalle?: string
        unidades?: { numeroSerie?: string; lote?: string }[]
      }>

    if (items.length === 0) { toast.error('Indicá cantidades a recibir'); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/ordenes-compra/${oc.id}/recibir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(mensajeErrorJson(data, 'No se pudo recepcionar la mercadería'))
      }
      toast.success('Mercadería recepcionada')
      onDone()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo recepcionar la mercadería'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-modal-overlay>
      <div className="bg-white rounded-[14px] w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#eef0f2] sticky top-0 bg-white">
          <h3 className="text-[14px] font-bold text-[#16181d]">Recepcionar {oc.numero}</h3>
        </div>
        <div className="p-5 space-y-4">
          {oc.items.map((item) => {
            const pendiente = item.cantidad - item.cantidadRecibida
            if (pendiente <= 0) return null
            const cant = cantidades[item.id] ?? 0
            const conStock = Boolean(item.inventarioId)
            const conTraz = conStock && trazabilidadActiva(item)
            return (
              <div key={item.id} className="border border-[#eef0f2] rounded-[10px] p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-[#1f242c] truncate">{item.descripcion}</p>
                    <p className="text-[11px] text-[#9aa1ab]">Pendiente: {pendiente}</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={pendiente}
                    value={cant}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setCantidades((c) => ({ ...c, [item.id]: v }))
                      syncUnidades(item.id, v, item)
                    }}
                    className="w-20 border border-[#e4e7eb] rounded-[8px] px-2 py-1.5 text-[13px] text-right"
                  />
                </div>
                {conStock && cant > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <label className="text-[11px] font-bold text-[#8a909a]">
                      Depósito
                      <select
                        value={depositosLinea[item.id] ?? defaultDeposito}
                        onChange={(e) => setDepositosLinea((d) => ({ ...d, [item.id]: e.target.value }))}
                        className="mt-1 w-full border border-[#e4e7eb] rounded-[8px] px-2 py-1.5 text-[13px]"
                      >
                        {depositos.map((d) => (
                          <option key={d.id} value={d.id}>{d.nombre}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-bold text-[#8a909a]">
                      Ubicación
                      <input
                        value={ubicaciones[item.id] ?? ''}
                        onChange={(e) => setUbicaciones((u) => ({ ...u, [item.id]: e.target.value }))}
                        className="mt-1 w-full border border-[#e4e7eb] rounded-[8px] px-2 py-1.5 text-[13px]"
                        placeholder="Estante, rack…"
                      />
                    </label>
                  </div>
                )}
                {conTraz && cant > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10.5px] font-bold text-[#8a909a] uppercase">N° serie / lote</p>
                    {Array.from({ length: cant }, (_, idx) => (
                      <div key={idx} className="grid grid-cols-2 gap-2">
                        <input
                          placeholder="N° serie"
                          value={unidades[item.id]?.[idx]?.numeroSerie ?? ''}
                          onChange={(e) => {
                            setUnidades((prev) => {
                              const arr = [...(prev[item.id] ?? Array(cant).fill({}))]
                              arr[idx] = { ...arr[idx], numeroSerie: e.target.value }
                              return { ...prev, [item.id]: arr }
                            })
                          }}
                          className="border border-[#e4e7eb] rounded-[8px] px-2 py-1 text-[12px]"
                        />
                        <input
                          placeholder="Lote"
                          value={unidades[item.id]?.[idx]?.lote ?? ''}
                          onChange={(e) => {
                            setUnidades((prev) => {
                              const arr = [...(prev[item.id] ?? Array(cant).fill({}))]
                              arr[idx] = { ...arr[idx], lote: e.target.value }
                              return { ...prev, [item.id]: arr }
                            })
                          }}
                          className="border border-[#e4e7eb] rounded-[8px] px-2 py-1 text-[12px]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="px-5 py-4 border-t border-[#eef0f2] flex justify-end gap-2 sticky bottom-0 bg-white">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" onClick={confirmar} loading={loading}>Confirmar recepción</Button>
        </div>
      </div>
    </div>
  )
}
