'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { PackageSearch, Plus, RefreshCw, Pencil, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useCan } from '@/components/auth/useCan'
import { formatFecha, formatMonto } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface FleteRow {
  id: string
  numero: string
  tipo: 'ENTRADA' | 'SALIDA'
  estado: 'BORRADOR' | 'EN_TRANSITO' | 'RECIBIDO' | 'CANCELADO'
  fechaEnvio: string | null
  fechaRecibido: string | null
  transportista: string | null
  guiaSeguimiento: string | null
  importe: number | null
  observaciones: string | null
  proveedorOrigenNombre: string | null
  clienteNombre: string | null
  facturaTransporte: string | null
  cliente?: { id: string; nombre: string } | null
  proveedorOrigen?: { id: string; razonSocial: string } | null
  ordenCompra?: { id: string; numero: string } | null
  remitoVenta?: { id: string; numero: string } | null
}

const ESTADO_FLETE: Record<string, { label: string; cls: string }> = {
  BORRADOR: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
  EN_TRANSITO: { label: 'En tránsito', cls: 'bg-blue-100 text-blue-700' },
  RECIBIDO: { label: 'Recibido', cls: 'bg-green-100 text-green-700' },
  CANCELADO: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
}

const TIPO_FLETE: Record<string, string> = {
  ENTRADA: '(I) Entrada',
  SALIDA: '(S) Salida',
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function emptyForm() {
  return {
    tipo: 'SALIDA' as FleteRow['tipo'],
    estado: '' as '' | FleteRow['estado'],
    fechaEnvio: '',
    fechaRecibido: '',
    transportista: '',
    guiaSeguimiento: '',
    importe: '',
    observaciones: '',
    proveedorOrigenNombre: '',
    clienteNombre: '',
    facturaTransporte: '',
  }
}

export function FletesManager({ inicial }: { inicial: FleteRow[] }) {
  const searchParams = useSearchParams()
  const puedeEditar = useCan('fletes.update')
  const [fletes, setFletes] = useState<FleteRow[]>(inicial)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroQ, setFiltroQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [guardando, setGuardando] = useState(false)
  const deepLinkHandled = useRef<string | null>(null)

  const recargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroTipo) params.set('tipo', filtroTipo)
      if (filtroEstado) params.set('estado', filtroEstado)
      if (filtroQ.trim()) params.set('q', filtroQ.trim())
      const res = await fetch(`/api/fletes?${params}`, { credentials: 'include' })
      const data = await res.json().catch(() => [])
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudieron cargar los fletes'))
      setFletes(data)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar fletes'))
    } finally {
      setLoading(false)
    }
  }, [filtroTipo, filtroEstado, filtroQ])

  useEffect(() => {
    const t = setTimeout(() => {
      recargar()
    }, 300)
    return () => clearTimeout(t)
  }, [recargar])

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id || deepLinkHandled.current === id) return
    const row = fletes.find((f) => f.id === id)
    if (row) {
      deepLinkHandled.current = id
      abrirEditar(row)
    }
  }, [searchParams, fletes])

  const filas = useMemo(() => fletes, [fletes])

  function abrirNuevo() {
    setEditId(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function abrirEditar(row: FleteRow) {
    setEditId(row.id)
    setForm({
      tipo: row.tipo,
      estado: row.estado,
      fechaEnvio: toInputDate(row.fechaEnvio),
      fechaRecibido: toInputDate(row.fechaRecibido),
      transportista: row.transportista ?? '',
      guiaSeguimiento: row.guiaSeguimiento ?? '',
      importe: row.importe != null ? String(row.importe) : '',
      observaciones: row.observaciones ?? '',
      proveedorOrigenNombre: row.proveedorOrigenNombre ?? row.proveedorOrigen?.razonSocial ?? '',
      clienteNombre: row.clienteNombre ?? row.cliente?.nombre ?? '',
      facturaTransporte: row.facturaTransporte ?? '',
    })
    setModalOpen(true)
  }

  async function guardar() {
    setGuardando(true)
    try {
      const body = {
        tipo: form.tipo,
        ...(form.estado ? { estado: form.estado } : {}),
        fechaEnvio: form.fechaEnvio ? form.fechaEnvio : null,
        fechaRecibido: form.fechaRecibido ? form.fechaRecibido : null,
        transportista: form.transportista || null,
        guiaSeguimiento: form.guiaSeguimiento || null,
        importe: form.importe === '' ? null : Number(form.importe),
        observaciones: form.observaciones || null,
        proveedorOrigenNombre: form.proveedorOrigenNombre || null,
        clienteNombre: form.clienteNombre || null,
        facturaTransporte: form.facturaTransporte || null,
      }

      const res = await fetch(editId ? `/api/fletes/${editId}` : '/api/fletes', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar el flete'))
      toast.success(editId ? 'Flete actualizado' : 'Flete creado')
      setModalOpen(false)
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al guardar'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <Select
          label="Tipo"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'ENTRADA', label: '(I) Entrada' },
            { value: 'SALIDA', label: '(S) Salida' },
          ]}
        />
        <Select
          label="Estado"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          options={[
            { value: '', label: 'Todos' },
            ...Object.entries(ESTADO_FLETE).map(([value, { label }]) => ({ value, label })),
          ]}
        />
        <div className="flex-1 min-w-[200px]">
          <Input
            label="Buscar"
            placeholder="Guía, transportista, cliente, proveedor…"
            value={filtroQ}
            onChange={(e) => setFiltroQ(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={recargar} loading={loading}>
          <RefreshCw size={14} /> Actualizar
        </Button>
        {puedeEditar && (
          <Button variant="primary" size="sm" onClick={abrirNuevo}>
            <Plus size={14} /> Nuevo flete
          </Button>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="bg-[#fafbfc] text-[10.5px] font-bold uppercase text-[#8a909a]">
              <th className="px-4 py-3 text-left">N°</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Fecha envío</th>
              <th className="px-4 py-3 text-left">Proveedor origen</th>
              <th className="px-4 py-3 text-left">Transporte</th>
              <th className="px-4 py-3 text-left">Guía</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Fecha recibido</th>
              <th className="px-4 py-3 text-left">Factura</th>
              <th className="px-4 py-3 text-right">Importe</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Vínculos</th>
              {puedeEditar && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={puedeEditar ? 13 : 12} className="px-4 py-10 text-center text-[13px] text-[#9aa1ab]">
                  {loading ? 'Cargando…' : 'No hay fletes registrados'}
                </td>
              </tr>
            ) : (
              filas.map((row) => {
                const est = ESTADO_FLETE[row.estado] ?? ESTADO_FLETE.BORRADOR
                const proveedor =
                  row.proveedorOrigen?.razonSocial ?? row.proveedorOrigenNombre ?? '—'
                const cliente = row.cliente?.nombre ?? row.clienteNombre ?? '—'
                return (
                  <tr key={row.id} className="hover:bg-[#fafbfc]">
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[12px] font-mono font-semibold">
                      {row.numero}
                    </td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[12px]">
                      {TIPO_FLETE[row.tipo] ?? row.tipo}
                    </td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[12px]">
                      {row.fechaEnvio ? formatFecha(row.fechaEnvio) : '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[12px]">{proveedor}</td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[12px]">
                      {row.transportista ?? '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[12px] font-mono">
                      {row.guiaSeguimiento ?? '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[12px]">{cliente}</td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[12px]">
                      {row.fechaRecibido ? formatFecha(row.fechaRecibido) : '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[12px]">
                      {row.facturaTransporte ?? '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[12px] text-right">
                      {row.importe != null ? formatMonto(row.importe) : '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3]">
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${est.cls}`}>
                        {est.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-[#f0f1f3] text-[11px] space-x-2">
                      {row.ordenCompra && (
                        <Link href="/compras" className="text-[#E8650A] hover:underline">
                          OC {row.ordenCompra.numero}
                        </Link>
                      )}
                      {row.remitoVenta && (
                        <Link href={`/remitos/${row.remitoVenta.id}`} className="text-[#E8650A] hover:underline">
                          Remito {row.remitoVenta.numero}
                        </Link>
                      )}
                      {row.cliente && (
                        <Link href={`/crm/${row.cliente.id}`} className="text-[#2563eb] hover:underline">
                          Cliente
                        </Link>
                      )}
                      {row.proveedorOrigen && (
                        <Link href={`/proveedores?highlight=${row.proveedorOrigen.id}`} className="text-[#2563eb] hover:underline">
                          Proveedor
                        </Link>
                      )}
                      {!row.ordenCompra && !row.remitoVenta && !row.cliente && !row.proveedorOrigen && '—'}
                    </td>
                    {puedeEditar && (
                      <td className="px-4 py-3 border-b border-[#f0f1f3] text-right">
                        <Button variant="outline" size="sm" onClick={() => abrirEditar(row)}>
                          <Pencil size={13} />
                        </Button>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {filas.some((f) => f.observaciones) && (
          <p className="px-4 py-2 text-[11px] text-[#9aa1ab] border-t border-[#eef0f2]">
            Las observaciones se editan en el formulario de cada fila.
          </p>
        )}
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-modal-overlay>
          <div className="bg-white rounded-[14px] w-full max-w-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef0f2] sticky top-0 bg-white z-10">
              <h3 className="text-[14px] font-bold text-[#16181d] flex items-center gap-2">
                <PackageSearch size={16} />
                {editId ? 'Editar flete' : 'Nuevo flete'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="Tipo"
                value={form.tipo}
                onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value as FleteRow['tipo'] }))}
                options={[
                  { value: 'ENTRADA', label: '(I) Entrada — inbound' },
                  { value: 'SALIDA', label: '(S) Salida — outbound' },
                ]}
              />
              <Select
                label="Estado (opcional)"
                value={form.estado}
                onChange={(e) => setForm((s) => ({ ...s, estado: e.target.value as FleteRow['estado'] | '' }))}
                placeholder="Automático"
                options={Object.entries(ESTADO_FLETE).map(([value, { label }]) => ({ value, label }))}
              />
              <Input
                label="Fecha de envío"
                type="date"
                value={form.fechaEnvio}
                onChange={(e) => setForm((s) => ({ ...s, fechaEnvio: e.target.value }))}
              />
              <Input
                label="Fecha de recibido"
                type="date"
                value={form.fechaRecibido}
                onChange={(e) => setForm((s) => ({ ...s, fechaRecibido: e.target.value }))}
              />
              <Input
                label="Proveedor (origen mercadería)"
                value={form.proveedorOrigenNombre}
                onChange={(e) => setForm((s) => ({ ...s, proveedorOrigenNombre: e.target.value }))}
              />
              <Input
                label="Cliente"
                value={form.clienteNombre}
                onChange={(e) => setForm((s) => ({ ...s, clienteNombre: e.target.value }))}
              />
              <Input
                label="Transporte (transportista)"
                value={form.transportista}
                onChange={(e) => setForm((s) => ({ ...s, transportista: e.target.value }))}
              />
              <Input
                label="Guía de seguimiento"
                value={form.guiaSeguimiento}
                onChange={(e) => setForm((s) => ({ ...s, guiaSeguimiento: e.target.value }))}
              />
              <Input
                label="Factura transporte"
                value={form.facturaTransporte}
                onChange={(e) => setForm((s) => ({ ...s, facturaTransporte: e.target.value }))}
              />
              <Input
                label="Importe"
                type="number"
                min={0}
                step="0.01"
                value={form.importe}
                onChange={(e) => setForm((s) => ({ ...s, importe: e.target.value }))}
              />
              <div className="md:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm((s) => ({ ...s, observaciones: e.target.value }))}
                  rows={3}
                  className="border border-[#e4e7eb] rounded-[8px] px-3 py-2 text-[13px] resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#eef0f2] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" loading={guardando} onClick={guardar}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
