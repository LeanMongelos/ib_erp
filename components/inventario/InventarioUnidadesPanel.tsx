'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { MODOS_TRAZABILIDAD, ESTADOS_UNIDAD_INVENTARIO, labelTipoDeposito } from '@/lib/inventario-constants'

export interface UnidadInventarioRow {
  id: string
  numeroSerie: string | null
  lote: string | null
  estado: string
  fechaIngreso: string
  notas: string | null
  ubicacionDetalle?: string | null
  deposito?: { id: string; nombre: string; tipo?: string | null } | null
  equipo?: { id: string; nombre: string } | null
}

interface Props {
  inventarioId: string
  modoTrazabilidad: string
  puedeEditar: boolean
  focusUnidadId?: string | null
  prefillDepositoId?: string | null
  prefillUbicacion?: string | null
  prefillNumeroSerie?: string | null
}

const formVacio = () => ({
  numeroSerie: '',
  lote: '',
  notas: '',
  depositoId: '',
  ubicacionDetalle: '',
})

export function InventarioUnidadesPanel({
  inventarioId,
  modoTrazabilidad,
  puedeEditar,
  focusUnidadId,
  prefillDepositoId,
  prefillUbicacion,
  prefillNumeroSerie,
}: Props) {
  const [unidades, setUnidades] = useState<UnidadInventarioRow[]>([])
  const [depositos, setDepositos] = useState<Array<{ id: string; nombre: string; tipo?: string }>>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(formVacio())
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const modo = MODOS_TRAZABILIDAD.find((m) => m.value === modoTrazabilidad)
  const muestraSerie = modoTrazabilidad === 'SERIE' || modoTrazabilidad === 'SERIE_Y_LOTE'
  const muestraLote = modoTrazabilidad === 'LOTE' || modoTrazabilidad === 'SERIE_Y_LOTE'

  const recargar = useCallback(async () => {
    const res = await fetch(`/api/inventario/${inventarioId}/unidades`, { credentials: 'include' })
    if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudieron cargar las unidades'))
    const data = await res.json()
    setUnidades(Array.isArray(data) ? data : [])
  }, [inventarioId])

  useEffect(() => {
    recargar().catch((e) => toast.error(mensajeErrorDesconocido(e, 'Error al cargar unidades')))
    fetch('/api/config/catalogos?tipo=depositos', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setDepositos(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [recargar])

  useEffect(() => {
    if (!focusUnidadId || unidades.length === 0) return
    const u = unidades.find((x) => x.id === focusUnidadId)
    if (u) iniciarEdicion(u)
  }, [focusUnidadId, unidades])

  useEffect(() => {
    if (focusUnidadId || editandoId) return
    if (!prefillDepositoId && !prefillUbicacion && !prefillNumeroSerie) return
    setForm((prev) => ({
      ...prev,
      depositoId: prefillDepositoId ?? prev.depositoId,
      ubicacionDetalle: prefillUbicacion ?? prev.ubicacionDetalle,
      numeroSerie: prefillNumeroSerie ?? prev.numeroSerie,
    }))
  }, [focusUnidadId, editandoId, prefillDepositoId, prefillUbicacion, prefillNumeroSerie])

  async function guardarNueva() {
    if (muestraSerie && !form.numeroSerie.trim()) {
      toast.error('Ingresá el número de serie')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/inventario/${inventarioId}/unidades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          numeroSerie: form.numeroSerie.trim() || null,
          lote: form.lote.trim() || null,
          notas: form.notas.trim() || null,
          depositoId: form.depositoId.trim() || null,
          ubicacionDetalle: form.ubicacionDetalle.trim() || null,
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo crear la unidad'))
      toast.success('Unidad agregada')
      setForm(formVacio())
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo crear la unidad'))
    } finally {
      setLoading(false)
    }
  }

  async function guardarEdicion(id: string) {
    if (muestraSerie && !form.numeroSerie.trim()) {
      toast.error('Ingresá el número de serie')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/inventario/unidades/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          numeroSerie: form.numeroSerie.trim() || null,
          lote: form.lote.trim() || null,
          notas: form.notas.trim() || null,
          depositoId: form.depositoId.trim() || null,
          ubicacionDetalle: form.ubicacionDetalle.trim() || null,
        }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo actualizar'))
      toast.success('Unidad actualizada')
      setEditandoId(null)
      setForm(formVacio())
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo actualizar'))
    } finally {
      setLoading(false)
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta unidad del inventario?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/inventario/unidades/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo eliminar'))
      toast.success('Unidad eliminada')
      await recargar()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo eliminar'))
    } finally {
      setLoading(false)
    }
  }

  function iniciarEdicion(u: UnidadInventarioRow) {
    setEditandoId(u.id)
    setForm({
      numeroSerie: u.numeroSerie ?? '',
      lote: u.lote ?? '',
      notas: u.notas ?? '',
      depositoId: u.deposito?.id ?? '',
      ubicacionDetalle: u.ubicacionDetalle ?? '',
    })
  }

  if (modoTrazabilidad === 'NINGUNA') {
    return (
      <p className="text-[12px] text-[#6b7280] py-4">
        Activá trazabilidad por serie o lote en la pestaña General para gestionar unidades individuales.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-[#6b7280]">
        Modo: <span className="font-semibold">{modo?.label ?? modoTrazabilidad}</span>. El stock se sincroniza con las unidades en estado «En stock».
        {muestraSerie && ' El número de serie es obligatorio y único en todo el inventario.'}
        {muestraLote && !muestraSerie && ' El lote es opcional al ingresar.'}
        {' '}Al cambiar el depósito de una unidad se registra una transferencia interna.
      </p>

      {puedeEditar && (
        <div className="border border-[#eef0f2] rounded-[9px] p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {muestraSerie && (
            <Input
              label="N° serie *"
              value={form.numeroSerie}
              onChange={(e) => setForm({ ...form, numeroSerie: e.target.value })}
              placeholder="Obligatorio · único en el ERP"
            />
          )}
          {muestraLote && (
            <Input
              label="Lote (opcional)"
              value={form.lote}
              onChange={(e) => setForm({ ...form, lote: e.target.value })}
              placeholder="Opcional"
            />
          )}
          <Select
            label="Depósito (opcional)"
            value={form.depositoId}
            onChange={(e) => setForm({ ...form, depositoId: e.target.value })}
            placeholder="Sin asignar"
            options={depositos.map((d) => ({ value: d.id, label: d.nombre }))}
          />
          <Input
            label="Ubicación detalle (opcional)"
            value={form.ubicacionDetalle}
            onChange={(e) => setForm({ ...form, ubicacionDetalle: e.target.value })}
            placeholder="Ej. Estante A · fila 3"
          />
          <div className="sm:col-span-2">
            <Input
              label="Notas"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            {editandoId ? (
              <>
                <Button variant="primary" size="sm" loading={loading} onClick={() => guardarEdicion(editandoId)}>
                  Guardar cambios
                </Button>
                <Button variant="secondary" size="sm" onClick={() => { setEditandoId(null); setForm(formVacio()) }}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" loading={loading} onClick={guardarNueva}>
                Agregar unidad
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-[#eef0f2] rounded-[9px]">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#fafbfc] text-[10.5px] uppercase text-[#6b7280]">
              <th className="px-3 py-2">Serie</th>
              <th className="px-3 py-2">Lote</th>
              <th className="px-3 py-2">Depósito</th>
              <th className="px-3 py-2">Ubicación</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Ingreso</th>
              <th className="px-3 py-2">Notas</th>
              {puedeEditar && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {unidades.map((u) => (
              <tr
                key={u.id}
                className={`border-t border-[#f4f5f7] text-[12px] ${u.id === focusUnidadId || u.id === editandoId ? 'bg-[#FFF4EC]' : ''}`}
              >
                <td className="px-3 py-2 font-mono">
                  {u.numeroSerie ?? (
                    <span className="text-red-500 font-semibold">Sin serie</span>
                  )}
                </td>
                <td className="px-3 py-2">{u.lote ?? '—'}</td>
                <td className="px-3 py-2">
                  {u.deposito ? (
                    <span title={labelTipoDeposito(u.deposito.tipo)}>{u.deposito.nombre}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-[#6b7280]">{u.ubicacionDetalle ?? '—'}</td>
                <td className="px-3 py-2">
                  {ESTADOS_UNIDAD_INVENTARIO.find((e) => e.value === u.estado)?.label ?? u.estado}
                </td>
                <td className="px-3 py-2 text-[#6b7280]">{u.fechaIngreso?.slice(0, 10) ?? '—'}</td>
                <td className="px-3 py-2 text-[#6b7280] max-w-[140px] truncate">{u.notas ?? '—'}</td>
                {puedeEditar && (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {u.estado !== 'VENDIDO' && (
                      <>
                        <button type="button" onClick={() => iniciarEdicion(u)} className="text-[11px] text-[#E8650A] hover:underline mr-2">
                          Editar
                        </button>
                        <button type="button" onClick={() => eliminar(u.id)} className="text-[11px] text-red-500 hover:underline">
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {unidades.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 8 : 7} className="px-3 py-6 text-center text-[12px] text-[#9aa1ab]">
                  Sin unidades registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
