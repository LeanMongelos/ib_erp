'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, ChevronDown, ChevronRight, Pencil, Trash2, RotateCcw, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useIsSuperAdmin } from '@/components/auth/useCan'
import { formatFechaHora } from '@/lib/utils'
import { mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'
import { etapaLabel, ETAPA_MAP, type EtapaKey } from '@/lib/crm/embudo-constants'
import styles from './embudo.module.css'

type TipoEvento = 'MOVIMIENTO' | 'CREACION' | 'EDICION' | 'ELIMINACION' | 'REACTIVACION'

interface SeguimientoEvento {
  id: string
  tipo: TipoEvento
  fecha: string
  movimiento: string
  usuario: string
  notas?: string | null
  datos?: unknown
  retroceso?: boolean
}

interface SeguimientoGrupo {
  negocio: {
    id: string
    numero: number
    nombre: string
    cliente: string
    vendedor: string
    etapa: string
    activo: boolean
  }
  totalEventos: number
  ultimoEvento: string
  eventos: SeguimientoEvento[]
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
  const [grupos, setGrupos] = useState<SeguimientoGrupo[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('')
  const [incluirInactivos, setIncluirInactivos] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [editando, setEditando] = useState<(SeguimientoEvento & { negocioId: string }) | null>(null)
  const [notasEdit, setNotasEdit] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (q.trim()) params.set('q', q.trim())
      if (tipo) params.set('tipo', tipo)
      if (incluirInactivos) params.set('incluirInactivos', 'true')
      const res = await fetch(`/api/crm/embudo/seguimiento?${params}`)
      if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Error al cargar seguimiento'))
      const data = await res.json()
      const nextGrupos: SeguimientoGrupo[] = data.grupos ?? []
      setGrupos(nextGrupos)
      setTotal(data.total ?? 0)
      setPage(data.page ?? 1)
      setPages(data.pages ?? 1)
      setExpandidos(new Set(nextGrupos.slice(0, 3).map((g) => g.negocio.id)))
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar seguimiento'))
    } finally {
      setLoading(false)
    }
  }, [page, q, tipo, incluirInactivos])

  useEffect(() => { cargar(1) }, [q, tipo, incluirInactivos]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleGrupo(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandirTodos() {
    setExpandidos(new Set(grupos.map((g) => g.negocio.id)))
  }

  function colapsarTodos() {
    setExpandidos(new Set())
  }

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

  async function eliminarRegistro(item: SeguimientoEvento) {
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

  function abrirEdicion(item: SeguimientoEvento, negocioId: string) {
    setEditando({ ...item, negocioId })
    setNotasEdit(item.notas ?? '')
  }

  const todosExpandidos = grupos.length > 0 && grupos.every((g) => expandidos.has(g.negocio.id))

  return (
    <div className={styles.seguimientoRoot}>
      <p className={styles.seguimientoHint}>
        Historial agrupado por negocio: cada tarjeta muestra la línea de tiempo de ese deal (creación, movimientos, cierre, etc.).
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
        {grupos.length > 0 && (
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={todosExpandidos ? colapsarTodos : expandirTodos}
          >
            {todosExpandidos ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
            {todosExpandidos ? 'Colapsar todos' : 'Expandir todos'}
          </button>
        )}
      </div>

      <div className={styles.seguimientoListWrap}>
        {loading ? (
          <p className="p-6 text-[13px] text-[#6b7280]">Cargando…</p>
        ) : grupos.length === 0 ? (
          <p className="p-6 text-[13px] text-[#6b7280]">Sin registros de seguimiento.</p>
        ) : (
          <div className={styles.seguimientoGrupos}>
            {grupos.map((grupo) => {
              const { negocio } = grupo
              const abierto = expandidos.has(negocio.id)
              const ultimo = grupo.eventos[0]
              const etapaColor = ETAPA_MAP[negocio.etapa as EtapaKey]?.color ?? '#6c757d'

              return (
                <article
                  key={negocio.id}
                  className={`${styles.seguimientoGrupo} ${!negocio.activo ? styles.negocioInactivo : ''}`}
                >
                  <button
                    type="button"
                    className={styles.seguimientoGrupoHeader}
                    onClick={() => toggleGrupo(negocio.id)}
                    aria-expanded={abierto}
                  >
                    <span className={styles.seguimientoGrupoChevron}>
                      {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <div className={styles.seguimientoGrupoMain}>
                      <div className={styles.seguimientoGrupoTitleRow}>
                        <span className={styles.seguimientoGrupoNum}>#{negocio.numero}</span>
                        <span className={styles.seguimientoGrupoNombre}>{negocio.nombre}</span>
                        <span
                          className={styles.seguimientoEtapaBadge}
                          style={{ background: `${etapaColor}18`, color: etapaColor, borderColor: `${etapaColor}40` }}
                        >
                          {etapaLabel(negocio.etapa as EtapaKey)}
                        </span>
                        {!negocio.activo && (
                          <span className={styles.seguimientoEliminadoBadge}>ELIMINADO</span>
                        )}
                      </div>
                      <div className={styles.seguimientoGrupoMeta}>
                        <span>{negocio.cliente}</span>
                        <span className={styles.seguimientoGrupoDot}>·</span>
                        <span>{negocio.vendedor}</span>
                        <span className={styles.seguimientoGrupoDot}>·</span>
                        <span>{grupo.totalEventos} evento{grupo.totalEventos !== 1 ? 's' : ''}</span>
                      </div>
                      {!abierto && ultimo && (
                        <div className={styles.seguimientoGrupoPreview}>
                          <span className={`${styles.tipoBadge} ${styles[`tipo${ultimo.tipo}`]}`}>
                            {TIPO_LABELS[ultimo.tipo]}
                          </span>
                          <span>{ultimo.movimiento}</span>
                          <span className={styles.seguimientoGrupoPreviewFecha}>
                            {formatFechaHora(ultimo.fecha)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={styles.seguimientoGrupoFecha}>
                      <span className={styles.seguimientoGrupoFechaLabel}>Última actividad</span>
                      <span>{formatFechaHora(grupo.ultimoEvento)}</span>
                    </div>
                  </button>

                  {abierto && (
                    <div className={styles.seguimientoTimeline}>
                      {grupo.eventos.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`${styles.seguimientoTimelineItem} ${item.retroceso ? styles.seguimientoTimelineRetroceso : ''}`}
                        >
                          <div className={styles.seguimientoTimelineRail}>
                            <span className={styles.seguimientoTimelineDot} />
                            {idx < grupo.eventos.length - 1 && <span className={styles.seguimientoTimelineLine} />}
                          </div>
                          <div className={styles.seguimientoTimelineBody}>
                            <div className={styles.seguimientoTimelineTop}>
                              <span className="text-[11px] text-[#6b7280]">{formatFechaHora(item.fecha)}</span>
                              <span className={`${styles.tipoBadge} ${styles[`tipo${item.tipo}`]}`}>
                                {TIPO_LABELS[item.tipo]}
                              </span>
                            </div>
                            <div className={styles.seguimientoTimelineMov}>{item.movimiento}</div>
                            <div className={styles.seguimientoTimelineUser}>{item.usuario}</div>
                            {item.notas && (
                              <p className={styles.seguimientoTimelineNotas}>{item.notas}</p>
                            )}
                            {esAdmin && (
                              <div className={styles.seguimientoActions}>
                                <button type="button" onClick={() => abrirEdicion(item, negocio.id)} title="Editar notas">
                                  <Pencil size={12} />
                                </button>
                                <button type="button" className="danger" onClick={() => eliminarRegistro(item)} title="Eliminar registro">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className={styles.seguimientoGrupoFooter}>
                        {negocio.activo ? (
                          <Link href="/crm/embudo" className="text-[12px] text-[#E8650A] font-semibold">
                            Ver en Kanban →
                          </Link>
                        ) : esAdmin ? (
                          <button
                            type="button"
                            className={`${styles.seguimientoActions} ${styles.seguimientoReactivarBtn}`}
                            onClick={() => reactivarNegocio(negocio.id)}
                          >
                            <RotateCcw size={12} />
                            Reactivar negocio
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>

      <div className={styles.seguimientoPagination}>
        <span>{total.toLocaleString('es-AR')} negocio{total !== 1 ? 's' : ''}</span>
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
