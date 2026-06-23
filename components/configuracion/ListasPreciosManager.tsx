'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Star, Tag, Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useCan } from '@/components/auth/useCan'
import { formatMontoMoneda } from '@/lib/moneda'
import { ETIQUETA_TIPO_LISTA } from '@/lib/precios/types'
import { mensajeErrorDesconocido, mensajeErrorJson, mensajeErrorRespuesta } from '@/lib/errores'

interface ListaResumen {
  id: string
  codigo: string
  nombre: string
  tipo: keyof typeof ETIQUETA_TIPO_LISTA
  moneda: string
  descuentoGlobalPct: number
  activo: boolean
  predeterminada: boolean
  _count?: { items: number; clientes: number }
}

interface ItemLista {
  id: string
  precioUnit: number
  bonificacionPct: number
  inventario: {
    id: string
    nombre: string
    sku: string | null
    moneda: string
    precioUnit: number | null
    activo: boolean
  }
}

const TIPOS_LISTA = Object.entries(ETIQUETA_TIPO_LISTA).map(([value, label]) => ({ value, label }))

export function ListasPreciosManager({ inicial }: { inicial: ListaResumen[] }) {
  const router = useRouter()
  const puedeGestionar = useCan('listas_precios.manage')
  const [listas, setListas] = useState(inicial)
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(inicial[0]?.id ?? null)
  const [items, setItems] = useState<ItemLista[]>([])
  const [cargandoItems, setCargandoItems] = useState(false)
  const [modalLista, setModalLista] = useState<null | 'nueva' | ListaResumen>(null)
  const [editPrecio, setEditPrecio] = useState<Record<string, string>>({})

  const seleccionada = listas.find((l) => l.id === seleccionadaId) ?? null

  const cargarItems = useCallback(async (listaId: string) => {
    setCargandoItems(true)
    try {
      const res = await fetch(`/api/listas-precios/${listaId}/items`, { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron cargar los ítems'))
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
      setEditPrecio({})
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar ítems de la lista'))
      setItems([])
    } finally {
      setCargandoItems(false)
    }
  }, [])

  useEffect(() => {
    if (seleccionadaId) cargarItems(seleccionadaId)
  }, [seleccionadaId, cargarItems])

  async function recargarListas() {
    const res = await fetch('/api/listas-precios', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) setListas(data)
    }
    router.refresh()
  }

  async function guardarPrecioItem(item: ItemLista) {
    if (!seleccionadaId || !puedeGestionar) return
    const raw = editPrecio[item.id] ?? String(item.precioUnit)
    const precioUnit = Number(raw)
    if (Number.isNaN(precioUnit) || precioUnit < 0) {
      toast.error('Precio inválido')
      return
    }
    try {
      const res = await fetch(`/api/listas-precios/${seleccionadaId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, precioUnit }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo actualizar el precio'))
      setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)))
      toast.success('Precio actualizado')
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo actualizar el precio'))
    }
  }

  async function darBajaLista(lista: ListaResumen) {
    if (!confirm(`¿Desactivar la lista ${lista.codigo}?`)) return
    const res = await fetch(`/api/listas-precios/${lista.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Lista desactivada')
      await recargarListas()
      setSeleccionadaId(null)
    } else {
      toast.error('No se pudo desactivar la lista')
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-[#7c828c]">
          Precios de venta por canal. Compras usan costo de proveedor, no estas listas.
        </p>
        {puedeGestionar && (
          <Button variant="primary" size="sm" onClick={() => setModalLista('nueva')}>
            <Plus size={15} /> Nueva lista
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <Card padding={false} className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f0f1f4]">
            <h3 className="text-[13px] font-bold text-[#1f242c]">Listas activas</h3>
          </div>
          <div className="divide-y divide-[#f4f5f7] max-h-[520px] overflow-y-auto">
            {listas.filter((l) => l.activo).map((lista) => (
              <button
                key={lista.id}
                type="button"
                onClick={() => setSeleccionadaId(lista.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  seleccionadaId === lista.id ? 'bg-[#FFF7ED]' : 'hover:bg-[#fafbfc]'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-bold text-[#16181d]">{lista.codigo}</span>
                  {lista.predeterminada && (
                    <Badge className="bg-[#FFF1E2] text-[#C4540A]"><Star size={10} /> Predeterminada</Badge>
                  )}
                </div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">{lista.nombre}</p>
                <p className="text-[11px] text-[#9aa1ab] mt-1">
                  {ETIQUETA_TIPO_LISTA[lista.tipo]} · {lista.moneda}
                  {lista._count ? ` · ${lista._count.items} ítems` : ''}
                </p>
              </button>
            ))}
            {listas.filter((l) => l.activo).length === 0 && (
              <p className="px-4 py-6 text-[12px] text-[#9aa1ab] text-center">Sin listas cargadas.</p>
            )}
          </div>
        </Card>

        <Card padding={false} className="overflow-hidden flex flex-col min-h-[420px]">
          {!seleccionada ? (
            <div className="flex-1 flex items-center justify-center text-[12.5px] text-[#9aa1ab] p-8">
              Seleccioná una lista para ver y editar precios por producto.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-[#f0f1f4] flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-[#E8650A]" />
                    <h3 className="text-[13.5px] font-bold text-[#16181d]">{seleccionada.nombre}</h3>
                  </div>
                  <p className="text-[12px] text-[#6b7280] mt-1">
                    {seleccionada.codigo} · {ETIQUETA_TIPO_LISTA[seleccionada.tipo]} · Desc. global {seleccionada.descuentoGlobalPct}%
                  </p>
                </div>
                {puedeGestionar && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModalLista(seleccionada)}
                      className="text-[11.5px] font-semibold text-[#5b626d] hover:text-[#E8650A] inline-flex items-center gap-1"
                    >
                      <Pencil size={13} /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => darBajaLista(seleccionada)}
                      className="text-[11.5px] font-semibold text-[#5b626d] hover:text-red-600 inline-flex items-center gap-1"
                    >
                      <Trash2 size={13} /> Baja
                    </button>
                  </div>
                )}
              </div>

              {cargandoItems ? (
                <p className="p-5 text-[12px] text-[#9aa1ab]">Cargando ítems…</p>
              ) : items.length === 0 ? (
                <p className="p-5 text-[12px] text-[#9aa1ab]">
                  Esta lista no tiene ítems. Ejecutá el seed o agregá productos desde inventario.
                </p>
              ) : (
                <div className="overflow-auto flex-1">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {['Producto', 'SKU', 'Base inventario', 'Precio lista', ''].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-[10px] font-bold text-[#8a909a] uppercase tracking-wide border-b border-[#f0f1f4] text-left last:text-right">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-[#f4f5f7] last:border-0">
                          <td className="px-4 py-2.5 text-[12.5px] text-[#1f242c]">{item.inventario.nombre}</td>
                          <td className="px-4 py-2.5 text-[11px] text-[#9aa1ab] font-mono">{item.inventario.sku ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[12px] text-[#6b7280]">
                            {item.inventario.precioUnit != null
                              ? formatMontoMoneda(item.inventario.precioUnit, item.inventario.moneda)
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            {puedeGestionar ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={editPrecio[item.id] ?? String(item.precioUnit)}
                                onChange={(e) => setEditPrecio((p) => ({ ...p, [item.id]: e.target.value }))}
                                onBlur={() => {
                                  const v = editPrecio[item.id]
                                  if (v != null && Number(v) !== item.precioUnit) guardarPrecioItem(item)
                                }}
                                className="w-28 text-[12px] border border-[#e4e7eb] rounded-[6px] px-2 py-1 text-right"
                              />
                            ) : (
                              <span className="text-[12.5px] font-semibold">
                                {formatMontoMoneda(item.precioUnit, seleccionada.moneda)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[11px] text-[#9aa1ab]">
                            {item.bonificacionPct > 0 ? `Bonif. ${item.bonificacionPct}%` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {modalLista && puedeGestionar && (
        <ListaModal
          lista={modalLista === 'nueva' ? undefined : modalLista}
          onClose={() => setModalLista(null)}
          onSaved={async (id) => {
            setModalLista(null)
            await recargarListas()
            if (id) setSeleccionadaId(id)
          }}
        />
      )}
    </div>
  )
}

function ListaModal({
  lista,
  onClose,
  onSaved,
}: {
  lista?: ListaResumen
  onClose: () => void
  onSaved: (id?: string) => void
}) {
  const esEdicion = Boolean(lista)
  const [form, setForm] = useState({
    codigo: lista?.codigo ?? '',
    nombre: lista?.nombre ?? '',
    tipo: lista?.tipo ?? 'MINORISTA',
    moneda: lista?.moneda ?? 'ARS',
    descuentoGlobalPct: lista?.descuentoGlobalPct != null ? String(lista.descuentoGlobalPct) : '0',
    predeterminada: lista?.predeterminada ?? false,
  })
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  async function guardar() {
    setLoading(true)
    try {
      const payload = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        moneda: form.moneda,
        descuentoGlobalPct: Number(form.descuentoGlobalPct) || 0,
        predeterminada: form.predeterminada,
      }
      const res = await fetch(esEdicion ? `/api/listas-precios/${lista!.id}` : '/api/listas-precios', {
        method: esEdicion ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar la lista'))
      toast.success(esEdicion ? 'Lista actualizada' : 'Lista creada')
      onSaved(data.id)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar la lista'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[14px] w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#eef0f2]">
          <h3 className="text-[14px] font-bold">{esEdicion ? 'Editar lista' : 'Nueva lista de precios'}</h3>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <Input label="Código" value={form.codigo} disabled={esEdicion} onChange={(e) => set('codigo', e.target.value)} placeholder="MIN-ARS" />
          <Select label="Moneda" value={form.moneda} onChange={(e) => set('moneda', e.target.value)} options={[{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]} />
          <div className="col-span-2">
            <Input label="Nombre" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Lista minorista ARS" />
          </div>
          <Select label="Tipo" value={form.tipo} onChange={(e) => set('tipo', e.target.value)} options={TIPOS_LISTA} />
          <Input label="Desc. global %" type="number" value={form.descuentoGlobalPct} onChange={(e) => set('descuentoGlobalPct', e.target.value)} />
          <label className="col-span-2 flex items-center gap-2 text-[12.5px] text-[#3a4150] cursor-pointer">
            <input type="checkbox" checked={form.predeterminada} onChange={(e) => set('predeterminada', e.target.checked)} />
            Predeterminada para su tipo y moneda
          </label>
        </div>
        <div className="px-5 py-4 border-t border-[#eef0f2] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={guardar}>Guardar</Button>
        </div>
      </div>
    </div>
  )
}
