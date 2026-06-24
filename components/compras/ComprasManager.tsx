'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Package, RefreshCw, Truck, ShoppingCart } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProveedorCombobox } from '@/components/proveedores/ProveedorCombobox'
import { formatFecha, formatMonto } from '@/lib/utils'
import { useCan } from '@/components/auth/useCan'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface OCItem {
  id: string
  descripcion: string
  cantidad: number
  cantidadRecibida: number
  precioUnit: number
  subtotal: number
}

interface OrdenCompra {
  id: string
  numero: string
  estado: string
  subtotal: number
  total: number
  creadoEn: string
  observaciones?: string | null
  proveedor?: { razonSocial: string }
  items: OCItem[]
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
}

const ESTADO_OC: Record<string, { label: string; cls: string }> = {
  BORRADOR:  { label: 'Borrador',  cls: 'bg-gray-100 text-gray-600' },
  ENVIADA:   { label: 'Enviada',   cls: 'bg-blue-100 text-blue-700' },
  PARCIAL:   { label: 'Parcial',   cls: 'bg-orange-100 text-orange-700' },
  RECIBIDA:  { label: 'Recibida',  cls: 'bg-green-100 text-green-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-red-100 text-red-600' },
}

export function ComprasManager({
  proveedores,
  inicialOrdenes = [],
  inicialFaltantes = [],
}: {
  proveedores: Proveedor[]
  inicialOrdenes?: OrdenCompra[]
  inicialFaltantes?: Faltante[]
}) {
  const router = useRouter()
  const puedeRecibir = useCan('compras.receive')
  const puedeAprobar = useCan('compras.approve')
  const puedeCrear = useCan('compras.create')
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>(inicialOrdenes)
  const [faltantes, setFaltantes] = useState<Faltante[]>(inicialFaltantes)
  const [loading, setLoading] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [proveedorId, setProveedorId] = useState('')
  const [recibir, setRecibir] = useState<OrdenCompra | null>(null)

  async function aprobarOc(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/ordenes-compra/${id}/aprobar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(mensajeErrorJson(data, 'No se pudo aprobar la OC'))
      }
      toast.success('OC aprobada — lista para recepción')
      await cargar()
      router.refresh()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo aprobar la OC'))
    } finally {
      setLoading(false)
    }
  }

  async function cargar() {
    setLoading(true)
    try {
      const [resOc, resFalt] = await Promise.all([
        fetch('/api/ordenes-compra'),
        fetch('/api/inventario/faltantes'),
      ])
      const ocs = await resOc.json()
      const falt = await resFalt.json()

      if (!resOc.ok) {
        throw new Error(mensajeErrorJson(ocs, 'No se pudieron cargar las órdenes de compra'))
      }
      if (!resFalt.ok) {
        throw new Error(mensajeErrorJson(falt, 'No se pudieron cargar los faltantes de stock'))
      }
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

  return (
    <div className="flex flex-col gap-4">
      {faltantes.length > 0 && (
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

      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-[#7c828c]">{ordenes.length} órdenes de compra</p>
        <button onClick={cargar} className="text-[12px] text-[#6b7280] hover:text-[#E8650A] inline-flex items-center gap-1">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

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
                {ordenes.map((oc, i) => {
                  const st = ESTADO_OC[oc.estado] ?? { label: oc.estado, cls: 'bg-gray-100 text-gray-600' }
                  const puedeRec = puedeRecibir && ['ENVIADA', 'APROBADA', 'PARCIAL'].includes(oc.estado)
                  const puedeApr = puedeAprobar && oc.estado === 'BORRADOR'
                  return (
                    <tr key={oc.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                      <td className="px-5 py-[13px] text-[12.5px] font-bold text-[#1f242c] border-b border-[#f4f5f7]">{oc.numero}</td>
                      <td className="px-5 py-[13px] text-[12.5px] text-[#6b7280] border-b border-[#f4f5f7]">{oc.proveedor?.razonSocial ?? '—'}</td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7]">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-[13px] text-[12.5px] font-semibold text-[#3a4150] border-b border-[#f4f5f7]">{formatMonto(oc.total)}</td>
                      <td className="px-5 py-[13px] text-[12px] text-[#9aa1ab] border-b border-[#f4f5f7]">{formatFecha(oc.creadoEn)}</td>
                      <td className="px-5 py-[13px] border-b border-[#f4f5f7] text-right">
                        <div className="flex gap-2 justify-end">
                          {puedeApr && (
                            <Button variant="primary" size="sm" disabled={loading} onClick={() => aprobarOc(oc.id)}>
                              Aprobar
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
                {ordenes.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-[12.5px] text-[#9aa1ab]">Sin órdenes de compra</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {recibir && (
        <RecibirModal oc={recibir} onClose={() => setRecibir(null)} onDone={() => { setRecibir(null); cargar(); router.refresh() }} />
      )}
    </div>
  )
}

function RecibirModal({ oc, onClose, onDone }: { oc: OrdenCompra; onClose: () => void; onDone: () => void }) {
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      oc.items.map((i) => [i.id, Math.max(i.cantidad - i.cantidadRecibida, 0)]),
    ),
  )
  const [loading, setLoading] = useState(false)

  async function confirmar() {
    const items = Object.entries(cantidades)
      .filter(([, c]) => c > 0)
      .map(([id, cantidad]) => ({ id, cantidad }))
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[14px] w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#eef0f2]">
          <h3 className="text-[14px] font-bold text-[#16181d]">Recepcionar {oc.numero}</h3>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {oc.items.map((item) => {
            const pendiente = item.cantidad - item.cantidadRecibida
            if (pendiente <= 0) return null
            return (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-[#1f242c] truncate">{item.descripcion}</p>
                  <p className="text-[11px] text-[#9aa1ab]">Pendiente: {pendiente}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={pendiente}
                  value={cantidades[item.id] ?? 0}
                  onChange={(e) => setCantidades((c) => ({ ...c, [item.id]: Number(e.target.value) }))}
                  className="w-20 border border-[#e4e7eb] rounded-[8px] px-2 py-1.5 text-[13px] text-right"
                />
              </div>
            )
          })}
        </div>
        <div className="px-5 py-4 border-t border-[#eef0f2] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" onClick={confirmar} loading={loading}>Confirmar recepción</Button>
        </div>
      </div>
    </div>
  )
}
