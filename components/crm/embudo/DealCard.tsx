'use client'

import { useEffect, useRef, useState } from 'react'
import { Flag, MoreHorizontal } from 'lucide-react'
import type { NegocioEmbudoDTO } from '@/lib/crm/embudo-utils'
import { alertaTarjeta, diasEnEtapa, formatEmbudoMonto } from '@/lib/crm/embudo-utils'
import { VENDEDOR_COLORS } from '@/lib/crm/embudo-constants'
import styles from './embudo.module.css'

interface DealCardProps {
  negocio: NegocioEmbudoDTO
  compact: boolean
  puedeEditar: boolean
  dragging?: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onVerHistorial: (id: string) => void
  onEliminar: (id: string) => void
}

export function DealCard({
  negocio,
  compact,
  puedeEditar,
  dragging,
  onDragStart,
  onDragEnd,
  onVerHistorial,
  onEliminar,
}: DealCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpen])

  const dias = diasEnEtapa(negocio.etapaDesde)
  const alerta = alertaTarjeta(negocio.etapaDesde, negocio.proximaAccionFecha)
  const vendedorColor = VENDEDOR_COLORS[negocio.vendedor] ?? VENDEDOR_COLORS.OTRO
  const tienePresupuesto = Boolean(negocio.presupuestoId)

  const alertClass =
    alerta === 'rojo' ? styles.cardAlertRojo
      : alerta === 'naranja' ? styles.cardAlertNaranja
        : alerta === 'amarillo' ? styles.cardAlertAmarillo
          : ''

  return (
    <div
      className={`${styles.card} ${compact ? styles.cardCompact : ''} ${dragging ? styles.cardDragging : ''} ${alertClass} ${menuOpen ? styles.cardMenuOpen : ''}`}
      draggable={puedeEditar}
      onDragStart={(e) => {
        if (!puedeEditar) { e.preventDefault(); return }
        e.dataTransfer.setData('text/plain', negocio.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(negocio.id)
      }}
      onDragEnd={onDragEnd}
    >
      {puedeEditar && (
        <div ref={menuRef} className={styles.cardMenuWrap}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            aria-label="Opciones"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className={styles.menuDropdown}>
              <button type="button" className={styles.menuItem} onClick={() => { setMenuOpen(false); onVerHistorial(negocio.id) }}>
                Ver historial
              </button>
              <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => { setMenuOpen(false); onEliminar(negocio.id) }}>
                Eliminar
              </button>
            </div>
          )}
        </div>
      )}
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderText}>
          <div className={styles.cardTitle}>#{negocio.numero} — {negocio.nombre}</div>
          {!compact && <div className={styles.cardCliente}>{negocio.cliente}</div>}
        </div>
      </div>
      <div className={styles.cardMonto}>{formatEmbudoMonto(negocio.monto)}</div>
      {!compact && (
        <div className={styles.cardFooter}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={styles.vendedorCircle} style={{ background: vendedorColor }} title={negocio.vendedor}>
              {negocio.vendedor}
            </span>
            <span className={`${styles.diasBadge} ${dias > 7 ? styles.diasBadgeAlert : ''}`}>
              {dias}d
            </span>
          </div>
          <span
            title={
              tienePresupuesto
                ? `Presupuesto ${negocio.presupuestoNumero ?? 'vinculado'}`
                : 'Sin presupuesto asignado'
            }
          >
            <Flag
              size={14}
              className={tienePresupuesto ? styles.presupuestoFlagCon : styles.presupuestoFlagSin}
              fill={tienePresupuesto ? 'currentColor' : 'none'}
            />
          </span>
        </div>
      )}
    </div>
  )
}
