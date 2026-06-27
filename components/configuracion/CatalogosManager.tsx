'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ConfigPageShell } from '@/components/configuracion/ConfigPageShell'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { TIPOS_DEPOSITO } from '@/lib/inventario-constants'

type Tab = 'categorias' | 'depositos' | 'condiciones'

interface Categoria { id: string; codigo: string; nombre: string; orden: number; activo: boolean }
interface Deposito { id: string; nombre: string; direccion: string | null; tipo?: string | null; activo: boolean }
interface CondicionPago { id: string; codigo: string; nombre: string; diasPlazo: number; plazosCobranza: string | null; activo: boolean; esDefault: boolean }

const TABS: { id: Tab; label: string }[] = [
  { id: 'categorias', label: 'Categorías de inventario' },
  { id: 'depositos', label: 'Depósitos' },
  { id: 'condiciones', label: 'Condiciones de pago' },
]

export function CatalogosManager() {
  const [tab, setTab] = useState<Tab>('categorias')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [condiciones, setCondiciones] = useState<CondicionPago[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ tipo: Tab; item?: Categoria | Deposito | CondicionPago } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/config/catalogos', { credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron cargar los catálogos'))
      const data = await res.json()
      setCategorias(data.categorias ?? [])
      setDepositos(data.depositos ?? [])
      setCondiciones(data.condicionesPago ?? [])
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar catálogos'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function toggleActivo(tipo: Tab, id: string, activo: boolean) {
    const map = { categorias: 'categoria', depositos: 'deposito', condiciones: 'condicion_pago' } as const
    const res = await fetch('/api/config/catalogos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: map[tipo], id, data: { activo: !activo } }),
    })
    if (res.ok) {
      toast.success(activo ? 'Desactivado' : 'Activado')
      cargar()
    } else toast.error(await mensajeErrorRespuesta(res, 'No se pudo actualizar'))
  }

  return (
    <ConfigPageShell>
      <p className="text-[12.5px] text-[#7c828c]">
        Maestros usados en inventario, stock y condiciones comerciales del ERP.
      </p>

      <div className="flex flex-wrap gap-2 border-b border-[#e4e7eb] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-colors ${
              tab === t.id ? 'bg-[#E8650A] text-white' : 'bg-white text-[#3a4150] border border-[#e4e7eb]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[12.5px] text-[#9aa1ab]">Cargando…</p>
      ) : (
        <>
          {tab === 'categorias' && (
            <TablaCatalogo
              titulo="Categorías de productos/equipos"
              onNuevo={() => setModal({ tipo: 'categorias' })}
              columnas={['Código', 'Nombre', 'Orden', 'Estado', '']}
              filas={categorias.map((c) => (
                <tr key={c.id} className="border-t border-[#f4f5f7]">
                  <td className="px-5 py-3 font-mono text-[12px]">{c.codigo}</td>
                  <td className="px-5 py-3 font-semibold text-[12.5px]">{c.nombre}</td>
                  <td className="px-5 py-3 text-[12px] text-[#6b7280]">{c.orden}</td>
                  <td className="px-5 py-3">
                    <EstadoBadge activo={c.activo} />
                  </td>
                  <td className="px-5 py-3 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setModal({ tipo: 'categorias', item: c })}><Pencil size={14} /></Button>
                    <Button variant="outline" size="sm" onClick={() => toggleActivo('categorias', c.id, c.activo)}>
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                  </td>
                </tr>
              ))}
            />
          )}

          {tab === 'depositos' && (
            <TablaCatalogo
              titulo="Depósitos y ubicaciones de stock"
              onNuevo={() => setModal({ tipo: 'depositos' })}
              columnas={['Nombre', 'Tipo', 'Dirección', 'Estado', '']}
              filas={depositos.map((d) => (
                <tr key={d.id} className="border-t border-[#f4f5f7]">
                  <td className="px-5 py-3 font-semibold text-[12.5px]">{d.nombre}</td>
                  <td className="px-5 py-3 text-[12px] text-[#6b7280]">
                    {TIPOS_DEPOSITO.find((t) => t.value === d.tipo)?.label ?? d.tipo ?? 'Depósito'}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[#6b7280]">{d.direccion ?? '—'}</td>
                  <td className="px-5 py-3"><EstadoBadge activo={d.activo} /></td>
                  <td className="px-5 py-3 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setModal({ tipo: 'depositos', item: d })}><Pencil size={14} /></Button>
                    <Button variant="outline" size="sm" onClick={() => toggleActivo('depositos', d.id, d.activo)}>
                      {d.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                  </td>
                </tr>
              ))}
            />
          )}

          {tab === 'condiciones' && (
            <TablaCatalogo
              titulo="Condiciones de pago (facturación y cobranzas)"
              onNuevo={() => setModal({ tipo: 'condiciones' })}
              columnas={['Código', 'Nombre', 'Plazo', 'Cuotas', 'Default', 'Estado', '']}
              filas={condiciones.map((c) => (
                <tr key={c.id} className="border-t border-[#f4f5f7]">
                  <td className="px-5 py-3 font-mono text-[12px]">{c.codigo}</td>
                  <td className="px-5 py-3 font-semibold text-[12.5px]">{c.nombre}</td>
                  <td className="px-5 py-3 text-[12px]">{c.diasPlazo} días</td>
                  <td className="px-5 py-3 text-[12px] text-[#6b7280]">{c.plazosCobranza ?? '—'}</td>
                  <td className="px-5 py-3 text-[12px]">{c.esDefault ? '★' : '—'}</td>
                  <td className="px-5 py-3"><EstadoBadge activo={c.activo} /></td>
                  <td className="px-5 py-3 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setModal({ tipo: 'condiciones', item: c })}><Pencil size={14} /></Button>
                    <Button variant="outline" size="sm" onClick={() => toggleActivo('condiciones', c.id, c.activo)}>
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                  </td>
                </tr>
              ))}
            />
          )}
        </>
      )}

      {modal && (
        <CatalogoModal
          tipo={modal.tipo}
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
    </ConfigPageShell>
  )
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

function TablaCatalogo({
  titulo, columnas, filas, onNuevo,
}: {
  titulo: string
  columnas: string[]
  filas: React.ReactNode
  onNuevo: () => void
}) {
  return (
    <Card padding={false}>
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <h3 className="text-[13px] font-bold">{titulo}</h3>
        <Button variant="primary" size="sm" onClick={onNuevo}><Plus size={14} /> Agregar</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {columnas.map((h) => (
                <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold text-[#8a909a] uppercase border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{filas}</tbody>
        </table>
      </div>
    </Card>
  )
}

function CatalogoModal({
  tipo, item, onClose, onSaved,
}: {
  tipo: Tab
  item?: Categoria | Deposito | CondicionPago
  onClose: () => void
  onSaved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const isEdit = !!item

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const map = { categorias: 'categoria', depositos: 'deposito', condiciones: 'condicion_pago' } as const
    const data: Record<string, unknown> = Object.fromEntries(fd.entries())
    if (tipo === 'condiciones' && fd.get('esDefault') === 'on') data.esDefault = true

    setLoading(true)
    try {
      const res = await fetch('/api/config/catalogos', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: map[tipo],
          id: item?.id,
          data,
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo guardar'))
      toast.success(isEdit ? 'Actualizado' : 'Creado')
      onSaved()
    } catch (err) {
      toast.error(mensajeErrorDesconocido(err, 'No se pudo guardar'))
    } finally {
      setLoading(false)
    }
  }

  const c = item as Categoria | undefined
  const d = item as Deposito | undefined
  const cp = item as CondicionPago | undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-modal-overlay>
      <form className="bg-white rounded-[14px] w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <div className="px-5 py-4 border-b">
          <h3 className="text-[14px] font-bold">{isEdit ? 'Editar' : 'Nuevo'} — {TABS.find((t) => t.id === tipo)?.label}</h3>
        </div>
        <div className="p-5 flex flex-col gap-3">
          {tipo === 'categorias' && (
            <>
              <Input label="Código" name="codigo" defaultValue={c?.codigo} required disabled={isEdit} />
              <Input label="Nombre" name="nombre" defaultValue={c?.nombre} required />
              <Input label="Orden" name="orden" type="number" defaultValue={c?.orden ?? 0} />
            </>
          )}
          {tipo === 'depositos' && (
            <>
              <Input label="Nombre" name="nombre" defaultValue={d?.nombre} required />
              <Select
                label="Tipo"
                name="tipo"
                defaultValue={d?.tipo ?? 'DEPOSITO'}
                options={[...TIPOS_DEPOSITO]}
              />
              <Input label="Dirección" name="direccion" defaultValue={d?.direccion ?? ''} />
            </>
          )}
          {tipo === 'condiciones' && (
            <>
              <Input label="Código" name="codigo" defaultValue={cp?.codigo} required disabled={isEdit} />
              <Input label="Nombre" name="nombre" defaultValue={cp?.nombre} required />
              <Input label="Días de plazo" name="diasPlazo" type="number" defaultValue={cp?.diasPlazo ?? 0} />
              <Input label="Plazos cobranza (ej. 30-60-90)" name="plazosCobranza" defaultValue={cp?.plazosCobranza ?? ''} />
              <label className="flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" name="esDefault" defaultChecked={cp?.esDefault} />
                Condición predeterminada
              </label>
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={loading}>Guardar</Button>
        </div>
      </form>
    </div>
  )
}
