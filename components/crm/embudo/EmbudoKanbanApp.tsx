'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { LayoutGrid, PanelLeftClose, PanelLeftOpen, Plus, Rows3, Search } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { useCan } from '@/components/auth/useCan'
import { useEmbudoSidebar } from '@/components/layout/SidebarContext'
import { mensajeErrorDesconocido } from '@/lib/errores'
import { ETAPAS, type EtapaKey, etapaOrder } from '@/lib/crm/embudo-constants'
import { validarMovimientoEmbudoCliente } from '@/lib/crm/embudo-movimiento-client'
import {
  getTransitionForm,
  NUEVO_NEGOCIO_FIELDS,
} from '@/lib/crm/embudo-forms'
import type { EmbudoStats, NegocioEmbudoDTO } from '@/lib/crm/embudo-utils'
import { formatEmbudoMonto } from '@/lib/crm/embudo-utils'
import { inicialesVendedor, type EmbudoCatalogos } from '@/components/crm/embudo/EmbudoFormFields'
import { DealCard } from './DealCard'
import { GenericFormModal, HistorialModal, TransitionFormModal } from './EmbudoModals'
import styles from './embudo.module.css'

const boardLayoutStyle = { '--embudo-cols': ETAPAS.length } as CSSProperties

interface PendingMove {
  negocioId: string
  etapaDesde: EtapaKey
  etapaHasta: EtapaKey
  retroceso: boolean
}

export function EmbudoKanbanApp() {
  const puedeEditar = useCan('crm.reply')
  const { data: session } = useSession()
  const { sidebarHidden, toggleSidebar } = useEmbudoSidebar()
  const [negocios, setNegocios] = useState<NegocioEmbudoDTO[]>([])
  const [stats, setStats] = useState<EmbudoStats>({ totalActivos: 0, pipelineArs: 0, cerradosMes: 0, ticketPromedio: 0 })
  const [catalogos, setCatalogos] = useState<EmbudoCatalogos>({ clientes: [], usuarios: [] })
  const [loading, setLoading] = useState(true)
  const [filtroVendedor, setFiltroVendedor] = useState('TODOS')
  const [filtroUrgencia, setFiltroUrgencia] = useState('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [compact, setCompact] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<EtapaKey | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [optimisticEtapa, setOptimisticEtapa] = useState<Record<string, EtapaKey>>({})
  const [modalNuevo, setModalNuevo] = useState(false)
  const [historial, setHistorial] = useState<{ negocioId: string; nombre: string; items: Array<{ id: string; fecha: string; movimiento: string; usuario: string; notas?: string | null; retroceso?: boolean }> } | null>(null)
  const [historialLoading, setHistorialLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [embudoRes, catRes] = await Promise.all([
        fetch('/api/crm/embudo'),
        fetch('/api/crm/embudo/catalogos'),
      ])
      if (!embudoRes.ok) throw new Error('No se pudo cargar el embudo')
      const data = await embudoRes.json()
      setNegocios(
        (data.negocios as Array<NegocioEmbudoDTO & { presupuesto?: { numero?: string } | null }>).map((n) => ({
          ...n,
          presupuestoNumero: n.presupuesto?.numero ?? n.presupuestoNumero ?? null,
        })),
      )
      setStats(data.stats)
      setOptimisticEtapa({})
      if (catRes.ok) {
        const cat = await catRes.json()
        setCatalogos({ clientes: cat.clientes ?? [], usuarios: cat.usuarios ?? [] })
      }
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar el embudo de ventas'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const negociosFiltrados = useMemo(() => {
    return negocios.filter((n) => {
      const etapaEff = optimisticEtapa[n.id] ?? n.etapa
      const item = { ...n, etapa: etapaEff }
      if (filtroVendedor !== 'TODOS' && item.vendedor !== filtroVendedor) return false
      if (filtroUrgencia === 'URGENTE' && item.urgencia !== 'URGENTE') return false
      if (filtroUrgencia === 'NORMAL' && item.urgencia !== 'NORMAL') return false
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        if (!item.nombre.toLowerCase().includes(q) && !item.cliente.toLowerCase().includes(q) && !String(item.numero).includes(q)) {
          return false
        }
      }
      return true
    })
  }, [negocios, filtroVendedor, filtroUrgencia, busqueda, optimisticEtapa])

  const negociosPorEtapa = useMemo(() => {
    const map: Record<EtapaKey, NegocioEmbudoDTO[]> = {} as Record<EtapaKey, NegocioEmbudoDTO[]>
    for (const e of ETAPAS) map[e.key] = []
    for (const n of negociosFiltrados) {
      const etapa = optimisticEtapa[n.id] ?? n.etapa
      map[etapa]?.push({ ...n, etapa })
    }
    return map
  }, [negociosFiltrados, optimisticEtapa])

  const columnTotals = useMemo(() => {
    const totals: Record<EtapaKey, { count: number; sum: number }> = {} as Record<EtapaKey, { count: number; sum: number }>
    for (const e of ETAPAS) {
      const items = negociosPorEtapa[e.key] ?? []
      totals[e.key] = { count: items.length, sum: items.reduce((s, n) => s + n.monto, 0) }
    }
    return totals
  }, [negociosPorEtapa])

  function handleDrop(etapaHasta: EtapaKey, negocioId: string) {
    setDragOverColumn(null)
    setDraggingId(null)
    if (!puedeEditar) return

    const negocio = negocios.find((n) => n.id === negocioId)
    if (!negocio) return

    const etapaDesde = (optimisticEtapa[negocioId] ?? negocio.etapa) as EtapaKey
    if (etapaDesde === etapaHasta) return

    const forward = etapaOrder(etapaHasta) === etapaOrder(etapaDesde) + 1
    const retroceso = etapaOrder(etapaHasta) < etapaOrder(etapaDesde)

    const errMov = validarMovimientoEmbudoCliente(etapaDesde, etapaHasta, retroceso)
    if (errMov) {
      toast.error(errMov)
      return
    }

    setOptimisticEtapa((prev) => ({ ...prev, [negocioId]: etapaHasta }))
    setPendingMove({ negocioId, etapaDesde, etapaHasta, retroceso })
  }

  function cancelMove() {
    if (pendingMove) {
      setOptimisticEtapa((prev) => {
        const next = { ...prev }
        delete next[pendingMove.negocioId]
        return next
      })
    }
    setPendingMove(null)
  }

  async function confirmMove(datos: Record<string, unknown>) {
    if (!pendingMove) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/embudo/${pendingMove.negocioId}/mover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapaHasta: pendingMove.etapaHasta,
          retroceso: pendingMove.retroceso,
          datos,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'No se pudo mover el negocio')
      }
      if (!pendingMove.retroceso && pendingMove.etapaDesde === 'ANALISIS' && pendingMove.etapaHasta === 'ENTREGA') {
        toast.success('🎉 ¡Venta ganada! Negocio movido a Entrega')
      } else if (
        !pendingMove.retroceso
        && pendingMove.etapaDesde === 'DOCUMENTACION'
        && pendingMove.etapaHasta === 'PROPUESTA'
      ) {
        const updated = await res.json()
        const num = (updated?.datos as Record<string, unknown> | undefined)?.numeroPropuesta
        toast.success(
          typeof num === 'string' && num
            ? `Presupuesto ${num} creado y vinculado al negocio`
            : 'Propuesta registrada y presupuesto vinculado',
        )
      } else if (pendingMove.retroceso) {
        toast.warning('Etapa retrocedida')
      } else {
        toast.success('Etapa actualizada')
      }
      setPendingMove(null)
      await fetchData()
    } catch (e) {
      cancelMove()
      toast.error(mensajeErrorDesconocido(e, 'Error al confirmar el movimiento'))
    } finally {
      setSaving(false)
    }
  }

  async function crearNegocio(datos: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch('/api/crm/embudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: datos.nombre,
          cliente: datos.cliente,
          clienteId: datos.clienteId || null,
          productoServicio: datos.productoServicio,
          inventarioId: datos.inventarioId || null,
          monto: datos.monto ? Number(datos.monto) : 0,
          vendedor: datos.vendedor,
          urgencia: datos.urgencia ?? 'NORMAL',
          etapa: datos.etapa ?? 'ENTRADA',
          notas: datos.notas,
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear el negocio')
      toast.success('Negocio creado')
      setModalNuevo(false)
      await fetchData()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al crear el negocio'))
    } finally {
      setSaving(false)
    }
  }

  async function verHistorial(id: string) {
    const n = negocios.find((x) => x.id === id)
    if (!n) return
    setHistorial({ negocioId: id, nombre: `#${n.numero} — ${n.nombre}`, items: [] })
    setHistorialLoading(true)
    try {
      const res = await fetch(`/api/crm/embudo/${id}/historial`)
      if (!res.ok) throw new Error('No se pudo cargar el historial')
      const items = await res.json()
      setHistorial({ negocioId: id, nombre: `#${n.numero} — ${n.nombre}`, items })
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al cargar historial'))
      setHistorial(null)
    } finally {
      setHistorialLoading(false)
    }
  }

  async function eliminarNegocio(id: string) {
    if (!confirm('¿Eliminar este negocio del embudo?')) return
    try {
      const res = await fetch(`/api/crm/embudo/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('No se pudo eliminar')
      toast.success('Negocio eliminado')
      await fetchData()
    } catch (e) {
      toast.error(mensajeErrorDesconocido(e, 'Error al eliminar'))
    }
  }

  const transitionForm = pendingMove
    ? getTransitionForm(pendingMove.etapaDesde, pendingMove.etapaHasta, pendingMove.retroceso)
    : null

  const negocioPending = pendingMove ? negocios.find((n) => n.id === pendingMove.negocioId) : null

  const vendedorDefault = session?.user?.name ? inicialesVendedor(session.user.name) : undefined

  if (loading) {
    return (
      <div className={styles.root} style={boardLayoutStyle}>
        <p style={{ padding: 24, color: '#6b7280', fontSize: 13 }}>Cargando embudo de ventas…</p>
      </div>
    )
  }

  return (
    <div className={styles.root} style={boardLayoutStyle}>
      <div className={styles.kpiBar}>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Negocios activos</span>
          <span className={styles.kpiValue}>{stats.totalActivos}</span>
        </div>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Pipeline ARS</span>
          <span className={styles.kpiValue}>{formatEmbudoMonto(stats.pipelineArs)}</span>
        </div>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Cerrados este mes</span>
          <span className={styles.kpiValue}>{stats.cerradosMes}</span>
        </div>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Ticket promedio</span>
          <span className={styles.kpiValue}>{formatEmbudoMonto(stats.ticketPromedio)}</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}>
          <option value="TODOS">Vendedor: Todos</option>
          <option value="GA">GA</option>
          <option value="LB">LB</option>
          <option value="BR">BR</option>
        </select>
        <select value={filtroUrgencia} onChange={(e) => setFiltroUrgencia(e.target.value)}>
          <option value="TODOS">Urgencia: Todas</option>
          <option value="URGENTE">Urgente</option>
          <option value="NORMAL">Normal</option>
        </select>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="search"
            placeholder="Buscar negocio o cliente…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ paddingLeft: 32, width: '100%' }}
          />
        </div>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={toggleSidebar}
          title={sidebarHidden ? 'Mostrar menú lateral' : 'Ocultar menú lateral'}
        >
          {sidebarHidden ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          {sidebarHidden ? 'Mostrar menú' : 'Ocultar menú'}
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${compact ? styles.toggleBtnActive : ''}`}
          onClick={() => setCompact((v) => !v)}
        >
          {compact ? <LayoutGrid size={14} /> : <Rows3 size={14} />}
          {compact ? 'Expandida' : 'Compacta'}
        </button>
      </div>

      <div className={styles.board}>
        {ETAPAS.map((col) => {
          const items = negociosPorEtapa[col.key] ?? []
          const tot = columnTotals[col.key]
          return (
            <div
              key={col.key}
              className={`${styles.column} ${dragOverColumn === col.key ? styles.columnDragOver : ''}`}
              onDragOver={(e) => {
                if (!puedeEditar) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverColumn(col.key)
              }}
              onDragLeave={() => setDragOverColumn((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain')
                if (id) handleDrop(col.key, id)
              }}
            >
              <div className={styles.columnHeader} style={{ background: col.color }}>
                <div className={styles.columnTitle}>{col.label}</div>
                <div className={styles.columnMeta}>
                  <span className={styles.badge}>{tot.count}</span>
                  <span>{formatEmbudoMonto(tot.sum)}</span>
                </div>
              </div>
              <div className={styles.columnBody}>
                {items.length === 0 ? (
                  <div className={styles.emptyColumn}>Sin negocios</div>
                ) : (
                  items.map((n) => (
                    <DealCard
                      key={n.id}
                      negocio={n}
                      compact={compact}
                      puedeEditar={puedeEditar}
                      dragging={draggingId === n.id}
                      onDragStart={setDraggingId}
                      onDragEnd={() => setDraggingId(null)}
                      onVerHistorial={verHistorial}
                      onEliminar={eliminarNegocio}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {puedeEditar && (
        <button type="button" className={styles.fab} onClick={() => setModalNuevo(true)} aria-label="Nuevo negocio">
          <Plus size={24} />
        </button>
      )}

      {pendingMove && transitionForm && negocioPending && (
        <TransitionFormModal
          open
          title={transitionForm.title}
          hint={transitionForm.hint}
          celebratory={transitionForm.celebratory}
          retroceso={pendingMove.retroceso}
          negocioNombre={`#${negocioPending.numero} — ${negocioPending.nombre}`}
          etapaDesde={pendingMove.etapaDesde}
          etapaHasta={pendingMove.etapaHasta}
          fields={transitionForm.fields}
          catalogos={catalogos}
          loading={saving}
          onConfirm={confirmMove}
          onCancel={cancelMove}
        />
      )}

      <GenericFormModal
        open={modalNuevo}
        title="Nuevo negocio"
        fields={NUEVO_NEGOCIO_FIELDS}
        catalogos={catalogos}
        vendedorDefault={vendedorDefault}
        loading={saving}
        submitLabel="Crear negocio"
        onConfirm={crearNegocio}
        onCancel={() => setModalNuevo(false)}
      />

      <HistorialModal
        open={!!historial}
        negocioNombre={historial?.nombre ?? ''}
        items={historial?.items ?? []}
        loading={historialLoading}
        onClose={() => setHistorial(null)}
      />
    </div>
  )
}
