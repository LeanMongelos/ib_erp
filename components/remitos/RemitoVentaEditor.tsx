'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Package, CheckCircle, Receipt } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { mensajeErrorDesconocido, mensajeErrorJson, mensajeErrorRespuesta } from '@/lib/errores'

interface ItemRemito {
  id: string
  descripcion: string
  codigo: string | null
  cantidad: number
  inventarioId: string | null
  numeroSerie: string | null
  inventarioUnidadId: string | null
  equipoId: string | null
  inventario?: { id: string; sku: string | null; nombre: string; modoTrazabilidad: string } | null
  inventarioUnidad?: { id: string; numeroSerie: string | null; deposito?: { nombre: string } | null } | null
  equipo?: { id: string; nombre: string; numeroSerie: string | null } | null
}

interface RemitoData {
  id: string
  numero: string
  estado: string
  cliente: { id: string; nombre: string }
  ordenVenta?: { presupuesto: { id: string; numero: string } } | null
  items: ItemRemito[]
  factura?: { id: string; numero: string } | null
}

interface UnidadOpt {
  id: string
  numeroSerie: string | null
  deposito?: { nombre: string } | null
}

interface EquipoOpt {
  id: string
  nombre: string
  numeroSerie: string | null
}

export function RemitoVentaEditor({ remitoId }: { remitoId: string }) {
  const router = useRouter()
  const [remito, setRemito] = useState<RemitoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accion, setAccion] = useState<string | null>(null)
  const [opciones, setOpciones] = useState<Record<string, { unidades: UnidadOpt[]; equipos: EquipoOpt[] }>>({})

  const recargar = useCallback(async () => {
    const res = await fetch(`/api/remitos-venta/${remitoId}`, { credentials: 'include' })
    if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo cargar el remito'))
    const data = await res.json()
    setRemito(data)
  }, [remitoId])

  useEffect(() => {
    recargar()
      .catch((e) => toast.error(mensajeErrorDesconocido(e, 'Error al cargar remito')))
      .finally(() => setLoading(false))
  }, [recargar])

  async function cargarOpciones(inventarioId: string) {
    if (opciones[inventarioId]) return opciones[inventarioId]
    const res = await fetch(
      `/api/remitos-venta/${remitoId}/unidades-disponibles?inventarioId=${encodeURIComponent(inventarioId)}`,
      { credentials: 'include' },
    )
    if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron cargar unidades'))
    const data = await res.json()
    const mapped = { unidades: data.unidadesStock ?? [], equipos: data.equiposCliente ?? [] }
    setOpciones((prev) => ({ ...prev, [inventarioId]: mapped }))
    return mapped
  }

  async function asignarSerie(item: ItemRemito, valor: string) {
    if (!valor) return
    setAccion(item.id)
    try {
      let body: Record<string, string> = {}
      if (valor.startsWith('u:')) body = { inventarioUnidadId: valor.slice(2) }
      else if (valor.startsWith('e:')) body = { equipoId: valor.slice(2) }
      else body = { numeroSerie: valor }

      const res = await fetch(`/api/remitos-venta/${remitoId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo asignar la serie'))
      toast.success('Serie asignada')
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al asignar serie'))
    } finally {
      setAccion(null)
    }
  }

  async function emitirRemito() {
    setAccion('emitir')
    try {
      const res = await fetch(`/api/remitos-venta/${remitoId}/emitir`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo emitir el remito'))
      toast.success('Remito emitido')
      await recargar()
      router.refresh()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al emitir remito'))
    } finally {
      setAccion(null)
    }
  }

  if (loading || !remito) {
    return <Card className="p-8 text-center text-[#6b7280]">Cargando remito…</Card>
  }

  const presupuestoId = remito.ordenVenta?.presupuesto?.id
  const puedeEditar = remito.estado === 'BORRADOR'
  const puedeFacturar = remito.estado === 'EMITIDO' && !remito.factura

  return (
    <div className="space-y-4">
      <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#9aa1ab] tracking-wide">Remito de venta</p>
          <h2 className="text-[20px] font-extrabold">{remito.numero}</h2>
          <p className="text-[13px] text-[#6b7280]">{remito.cliente.nombre} · {remito.estado}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {presupuestoId && (
            <Link href={`/presupuestos/${presupuestoId}`}>
              <Button variant="outline" size="sm">Ver presupuesto</Button>
            </Link>
          )}
          {puedeEditar && (
            <Button variant="primary" size="sm" loading={accion === 'emitir'} onClick={emitirRemito}>
              <CheckCircle size={14} /> Emitir remito
            </Button>
          )}
          {puedeFacturar && (
            <Link href={`/facturacion/nueva?remitoId=${remito.id}`}>
              <Button variant="primary" size="sm">
                <Receipt size={14} /> Generar factura
              </Button>
            </Link>
          )}
          {remito.factura && (
            <Link href="/facturacion">
              <Button variant="outline" size="sm">Factura {remito.factura.numero}</Button>
            </Link>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#fafbfc] text-[10.5px] font-bold uppercase text-[#8a909a]">
              <th className="px-5 py-3 text-left">Producto</th>
              <th className="px-5 py-3 text-right">Cant.</th>
              <th className="px-5 py-3 text-left">N° serie / unidad</th>
              <th className="px-5 py-3 text-left">Depósito</th>
            </tr>
          </thead>
          <tbody>
            {remito.items.map((item) => (
              <FilaItemRemito
                key={item.id}
                item={item}
                puedeEditar={puedeEditar}
                loading={accion === item.id}
                onFocus={() => item.inventarioId && cargarOpciones(item.inventarioId).catch(() => null)}
                opciones={item.inventarioId ? opciones[item.inventarioId] : undefined}
                onAsignar={(v) => asignarSerie(item, v)}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function FilaItemRemito({
  item,
  puedeEditar,
  loading,
  onFocus,
  opciones,
  onAsignar,
}: {
  item: ItemRemito
  puedeEditar: boolean
  loading: boolean
  onFocus: () => void
  opciones?: { unidades: UnidadOpt[]; equipos: EquipoOpt[] }
  onAsignar: (valor: string) => void
}) {
  const [sel, setSel] = useState('')

  const deposito =
    item.inventarioUnidad?.deposito?.nombre ??
    (item.equipo ? 'En cliente' : '—')

  const serieMostrar =
    item.numeroSerie ??
    item.inventarioUnidad?.numeroSerie ??
    item.equipo?.numeroSerie ??
    '—'

  const opts: Array<{ value: string; label: string }> = []
  if (opciones) {
    for (const u of opciones.unidades ?? []) {
      opts.push({
        value: `u:${u.id}`,
        label: [u.numeroSerie && `SN ${u.numeroSerie}`, u.deposito?.nombre && `· ${u.deposito.nombre}`]
          .filter(Boolean)
          .join(' ') || u.id.slice(-6),
      })
    }
    for (const e of opciones.equipos ?? []) {
      opts.push({
        value: `e:${e.id}`,
        label: `Equipo cliente: ${e.numeroSerie ?? e.nombre}`,
      })
    }
  }

  return (
    <tr>
      <td className="px-5 py-3 border-b border-[#f4f5f7]">
        <div className="flex items-start gap-2">
          <Package size={14} className="text-[#9aa1ab] mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold">{item.descripcion}</p>
            {item.codigo && <p className="text-[10px] font-mono text-[#9aa1ab]">{item.codigo}</p>}
          </div>
        </div>
      </td>
      <td className="px-5 py-3 border-b border-[#f4f5f7] text-right text-[13px]">{item.cantidad}</td>
      <td className="px-5 py-3 border-b border-[#f4f5f7]">
        {puedeEditar && item.inventarioId ? (
          <Select
            value={sel}
            onChange={(e) => {
              setSel(e.target.value)
              onAsignar(e.target.value)
            }}
            onFocus={onFocus}
            disabled={loading}
            options={[{ value: '', label: serieMostrar !== '—' ? `Actual: ${serieMostrar}` : 'Seleccionar serie…' }, ...opts]}
          />
        ) : (
          <span className="text-[12px] font-mono">{serieMostrar}</span>
        )}
      </td>
      <td className="px-5 py-3 border-b border-[#f4f5f7] text-[12px] text-[#6b7280]">{deposito}</td>
    </tr>
  )
}
