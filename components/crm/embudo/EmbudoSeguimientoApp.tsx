'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { Search, ChevronDown, ChevronRight, Pencil, Trash2, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useIsSuperAdmin } from '@/components/auth/useCan'
import { formatFechaHora } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import styles from './embudo.module.css'

type TipoEvento = 'MOVIMIENTO' | 'CREACION' | 'EDICION' | 'ELIMINACION' | 'REACTIVACION'

interface SeguimientoItem {
  id: string
  tipo: TipoEvento
  fecha: string
  movimiento: string
  usuario: string
  notas?: string | null
  datos?: unknown
  retroceso?: boolean
  negocio: {
    id: string
    numero: number
    nombre: string
    cliente: string
    vendedor: string
    etapa: string
    activo: boolean
  } | null
}

const TIPO_LABELS: Record<TipoEvento, string> = {
  MOVIMIENTO: 'Movimiento',
  CREACION: 'Creación',
  EDICION: 'Edición',
  ELIMINACION: 'Eliminación',
  REACTIVACION: 'Reactivación',
}

export function EmbudoSeguimientoApp() {
  const esAdmin = useIsSuperAdmin()
  const [items, setItems] = useState<SeguimientoItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('')
  const [incluirInactivos, setIncluirInactivos] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [editando, setEditando] = useState<SeguimientoItem | null>(null)
  const [notasEdit, setNotasEdit] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '40' })
      if (q.trim()) params.set('q', q.trim())
      if (tipo) params.set('tipo', tipo)
      if (incluirInactivos) params.set('incluirInactivos', 'true')
      const res = await fetch(`/api/crm/embudo/seguimiento?${params}`)
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar seguimiento'))
      const data = await res.json()
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
      setPage(data.page ?? 1)
      setPages(data.pages ?? 1)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar seguimiento'))
    } finally {
      setLoading(false)
    }
  }, [page, q, tipo, incluirInactivos])

  useEffect(() => { cargar(1) }, [q, tipo, incluirInactivos]) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardarEdicion() {
    if (!editando) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/embudo/seguimiento/${editando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas: notasEdit || null }),
      })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al guardar'))
      toast.success('Registro actualizado')
      setEditando(null)
      cargar(page)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  async function eliminarRegistro(item: SeguimientoItem) {
    if (!confirm('¿Eliminar este registro de seguimiento? Solo el administrador puede hacerlo.')) return
    try {
      const res = await fetch(`/api/crm/embudo/seguimiento/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al eliminar'))
      toast.success('Registro eliminado')
      cargar(page)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al eliminar'))
    }
  }

  async function reactivarNegocio(negocioId: string) {
    if (!confirm('¿Reactivar este negocio en el pipeline de ventas?')) return
    try {
      const res = await fetch(`/api/crm/embudo/${negocioId}/reactivar`, { method: 'POST' })
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al reactivar'))
      toast.success('Negocio reactivado en el pipeline')
      cargar(page)
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al reactivar'))
    }
  }

  function abrirEdicion(item: SeguimientoItem) {
    setEditando(item)
    setNotasEdit(item.notas ?? '')
  }

  return (
    <div className={styles.seguimientoRoot}>
      <p className={styles.seguimientoHint}>
        Historial de negocios del embudo: creación, movimientos, ganados, perdidos y eliminaciones.
        {esAdmin ? ' Como administrador podés editar, borrar registros y reactivar negocios.' : ' Solo lectura.'}
      </p>

      <div className={styles.seguimientoToolbar}>
        <div className="flex items-center gap-2 bg-[#f4f6f9] border border-[#e4e7eb] rounded-[9px] px-3 py-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-[#9aa1ab]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar negocio, cliente, usuario…"
            className="flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los eventos</option>
          {(Object.keys(TIPO_LABELS) as TipoEvento[]).map((t) => (
            <option key={t} value={t}>{TIPO_LABELS[t]}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[12.5px] text-[#6b7280] cursor-pointer">
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(e) => setIncluirInactivos(e.target.checked)}
          />
          Incluir eliminados
        </label>
      </div>

      <div className={styles.seguimientoTableWrap}>
        {loading ? (
          <p className="p-6 text-[13px] text-[#6b7280]">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-[13px] text-[#6b7280]">Sin registros de seguimiento.</p>
        ) : (
          <table className={styles.seguimientoTable}>
            <thead>
              <tr>
                <th style={{ width: 28 }} />
                <th>Fecha</th>
                <th>Negocio</th>
                <th>Evento</th>
                <th>Usuario</th>
                <th>Notas</th>
                {esAdmin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr className={!item.negocio?.activo ? styles.negocioInactivo : undefined}>
                    <td>
                      <button
                        type="button"
                        className="p-1 text-[#9aa1ab]"
                        onClick={() => setExpandido(expandido === item.id ? null : item.id)}
                        aria-label="Ver detalle"
                      >
                        {expandido === item.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="whitespace-nowrap text-[#6b7280]">{formatFechaHora(item.fecha)}</td>
                    <td>
                      {item.negocio ? (
                        <>
                          <span className="font-semibold">#{item.negocio.numero}</span>
                          {' '}{item.negocio.nombre}
                          <br />
                          <span className="text-[11px] text-[#9aa1ab]">{item.negocio.cliente} · {item.negocio.vendedor}</span>
                          {!item.negocio.activo && (
                            <span className="ml-1 text-[10px] font-bold text-[#c62828]">ELIMINADO</span>
                          )}
                        </>
                      ) : (
                        <span className="text-[#9aa1ab]">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.tipoBadge} ${styles[`tipo${item.tipo}`]}`}>
                        {TIPO_LABELS[item.tipo]}
                      </span>
                      <div className="mt-1 font-medium">{item.movimiento}</div>
                    </td>
                    <td>{item.usuario}</td>
                    <td className="max-w-[200px] truncate" title={item.notas ?? undefined}>
                      {item.notas || '—'}
                    </td>
                    {esAdmin && (
                      <td>
                        <div className={styles.seguimientoActions}>
                          <button type="button" onClick={() => abrirEdicion(item)} title="Editar notas">
                            <Pencil size={12} />
                          </button>
                          <button type="button" className="danger" onClick={() => eliminarRegistro(item)} title="Eliminar registro">
                            <Trash2 size={12} />
                          </button>
                          {item.negocio && !item.negocio.activo && (
                            <button
                              type="button"
                              className="primary"
                              onClick={() => reactivarNegocio(item.negocio!.id)}
                              title="Reactivar en pipeline"
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {expandido === item.id && (
                    <tr>
                      <td colSpan={esAdmin ? 7 : 6}>
                        <pre className="text-[11px] bg-[#f4f6f9] p-3 rounded-lg overflow-auto max-h-40">
                          {JSON.stringify(item.datos, null, 2)}
                        </pre>
                        {item.negocio?.activo && (
                          <Link href="/crm/embudo" className="text-[12px] text-[#E8650A] font-semibold mt-2 inline-block">
                            Ver en Kanban →
                          </Link>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.seguimientoPagination}>
        <span>{total.toLocaleString('es-AR')} eventos</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => cargar(page - 1)}
            className="px-3 py-1 border rounded-lg disabled:opacity-40"
          >
            Anterior
          </button>
          <span>Pág. {page} / {pages}</span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => cargar(page + 1)}
            className="px-3 py-1 border rounded-lg disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>

      {editando && (
        <div className={styles.overlay} role="dialog">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Editar registro de seguimiento</div>
              <div className={styles.modalSubtitle}>{editando.movimiento}</div>
            </div>
            <div className={styles.modalBody}>
              <label className="block text-[12px] font-semibold mb-1">Notas</label>
              <textarea
                value={notasEdit}
                onChange={(e) => setNotasEdit(e.target.value)}
                rows={4}
                className="w-full border border-[#e4e7eb] rounded-lg p-2 text-[13px]"
              />
            </div>
            <div className={styles.modalFooter}>
              <Button type="button" variant="secondary" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" loading={saving} onClick={guardarEdicion}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
