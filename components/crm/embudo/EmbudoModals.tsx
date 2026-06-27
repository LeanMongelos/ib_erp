'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FormField } from '@/lib/crm/embudo-forms'
import {
  defaultFormValues,
  validateForm,
} from '@/lib/crm/embudo-forms'
import type { EtapaKey } from '@/lib/crm/embudo-constants'
import { etapaLabel } from '@/lib/crm/embudo-constants'
import {
  renderEmbudoField,
  type EmbudoCatalogos,
  inicialesVendedor,
} from '@/components/crm/embudo/EmbudoFormFields'
import styles from './embudo.module.css'

interface TransitionFormModalProps {
  open: boolean
  title: string
  hint?: string
  celebratory?: boolean
  retroceso?: boolean
  negocioNombre: string
  etapaDesde: EtapaKey
  etapaHasta: EtapaKey
  fields: FormField[]
  catalogos?: EmbudoCatalogos
  negocioContext?: import('@/components/crm/embudo/EmbudoFormFields').EmbudoNegocioContext
  loading?: boolean
  onConfirm: (datos: Record<string, unknown>) => void
  onCancel: () => void
}

function Confetti() {
  const colors = ['#ffc107', '#0d6efd', '#198754', '#fd7e14', '#6610f2']
  return (
    <div className={styles.confetti} aria-hidden>
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          className={styles.confettiPiece}
          style={{
            left: `${(i * 4.2) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 8) * 0.1}s`,
          }}
        />
      ))}
    </div>
  )
}

export function TransitionFormModal({
  open,
  title,
  hint,
  celebratory,
  retroceso,
  negocioNombre,
  etapaDesde,
  etapaHasta,
  fields,
  catalogos,
  negocioContext,
  loading,
  onConfirm,
  onCancel,
}: TransitionFormModalProps) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const inventarioPrecios = useRef(new Map<string, number>())

  useEffect(() => {
    if (open) setValues(defaultFormValues(fields))
  }, [open, fields])

  if (!open) return null

  function setField(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateForm(fields, values)
    if (err) {
      alert(err)
      return
    }
    onConfirm(values)
  }

  function renderField(f: FormField) {
    return renderEmbudoField(f, values, setField, catalogos, inventarioPrecios, negocioContext)
  }

  return (
    <div className={styles.overlay} data-modal-overlay>
      <div
        className={`${styles.modal} ${retroceso ? styles.modalRetroceso : ''}`}
        style={{ position: 'relative' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="embudo-modal-title"
        data-modal-panel
      >
        {celebratory && <Confetti />}
        <div className={celebratory ? styles.modalHeaderCelebration : styles.modalHeader}>
          {celebratory && (
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🎉 ¡VENTA GANADA!</div>
          )}
          <div className={styles.modalTitle} id="embudo-modal-title">{title}</div>
          <div className={styles.modalSubtitle}>{negocioNombre}</div>
          <div className={styles.transitionArrow}>
            <span>{etapaLabel(etapaDesde)}</span>
            <ArrowRight size={14} />
            <span>{etapaLabel(etapaHasta)}</span>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {hint && (
              <p style={{ fontSize: 12.5, color: '#5b626d', marginBottom: 12, lineHeight: 1.45 }}>{hint}</p>
            )}
            <div className={styles.formGrid}>
              {fields.map(renderField)}
            </div>
          </div>
          <div className={styles.modalFooter}>
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" variant={retroceso ? 'danger' : 'primary'} loading={loading}>
              {retroceso ? 'Confirmar retroceso' : 'Confirmar avance'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface HistorialModalProps {
  open: boolean
  negocioNombre: string
  items: Array<{ id: string; fecha: string; movimiento: string; usuario: string; notas?: string | null; retroceso?: boolean }>
  loading?: boolean
  onClose: () => void
}

export function HistorialModal({ open, negocioNombre, items, loading, onClose }: HistorialModalProps) {
  if (!open) return null

  return (
    <div className={styles.overlay} data-modal-overlay>
      <div className={styles.modal} role="dialog" aria-modal="true" data-modal-panel>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Historial del negocio</div>
          <div className={styles.modalSubtitle}>{negocioNombre}</div>
        </div>
        <div className={styles.modalBody}>
          {loading ? (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Cargando historial…</p>
          ) : items.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Sin movimientos registrados.</p>
          ) : (
            <div className={styles.historialList}>
              {items.map((h) => (
                <div
                  key={h.id}
                  className={`${styles.historialItem} ${h.retroceso ? styles.historialItemRetroceso : ''}`}
                >
                  <div className={styles.historialFecha}>
                    {new Date(h.fecha).toLocaleString('es-AR')} · {h.usuario}
                  </div>
                  <div className={styles.historialMov}>{h.movimiento}</div>
                  {h.notas && <p style={{ fontSize: 12, marginTop: 4, color: '#495057' }}>{h.notas}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <Button type="button" variant="secondary" onClick={onClose}>
            <X size={14} /> Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}

interface GenericFormModalProps {
  open: boolean
  title: string
  fields: FormField[]
  catalogos?: EmbudoCatalogos
  vendedorDefault?: string
  loading?: boolean
  submitLabel?: string
  onConfirm: (datos: Record<string, unknown>) => void
  onCancel: () => void
}

export function GenericFormModal({
  open,
  title,
  fields,
  catalogos,
  vendedorDefault,
  loading,
  submitLabel = 'Guardar',
  onConfirm,
  onCancel,
}: GenericFormModalProps) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const inventarioPrecios = useRef(new Map<string, number>())

  useEffect(() => {
    if (open) {
      const defaults = defaultFormValues(fields)
      if (!defaults.etapa) defaults.etapa = 'ENTRADA'
      if (!defaults.urgencia) defaults.urgencia = 'NORMAL'
      if (!defaults.vendedor && vendedorDefault) defaults.vendedor = vendedorDefault
      setValues(defaults)
    }
  }, [open, fields, vendedorDefault])

  if (!open) return null

  function setField(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateForm(fields, values)
    if (err) { alert(err); return }
    onConfirm(values)
  }

  return (
    <div className={styles.overlay} data-modal-overlay>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="embudo-generic-modal-title" data-modal-panel>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle} id="embudo-generic-modal-title">{title}</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGrid}>
              {fields.map((f) => renderEmbudoField(f, values, setField, catalogos, inventarioPrecios))}
            </div>
          </div>
          <div className={styles.modalFooter}>
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancelar</Button>
            <Button type="submit" loading={loading}>{submitLabel}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
