/**
 * Borrador incompleto vs presupuesto listo (pendiente de respuesta).
 */
import { presupuestoDebeMarcarseVencido } from '@/lib/presupuestos/vencimiento'

export type PresupuestoCompletitudInput = {
  estado: string
  total: number
  clienteId?: string | null
  items?: Array<{ descripcion?: string | null; cantidad?: number; precioUnit?: number }>
  itemCount?: number
}

export function presupuestoEsIncompleto(p: PresupuestoCompletitudInput): boolean {
  const items = p.items ?? []
  const itemCount = items.length || p.itemCount || 0

  if (!p.clienteId) return true
  if (itemCount === 0) return true

  const lineasValidas = items.filter(
    (i) => (i.descripcion?.trim()?.length ?? 0) >= 1 && (i.cantidad ?? 0) > 0,
  )
  if (items.length > 0 && lineasValidas.length === 0) return true

  if (p.total <= 0) {
    const sub = lineasValidas.reduce((a, i) => a + (i.cantidad ?? 0) * (i.precioUnit ?? 0), 0)
    if (sub <= 0) return true
  }

  return false
}

/** Estado a mostrar en UI (Borrador solo si falta cargar datos). */
export function estadoPresupuestoParaUi(
  p: PresupuestoCompletitudInput & { fechaVencimiento?: Date | string | null },
  ahora: Date = new Date(),
): string {
  if (presupuestoEsIncompleto(p)) return 'BORRADOR'

  if (p.estado === 'BORRADOR') return 'ENVIADO'

  if (
    (p.estado === 'ENVIADO' || p.estado === 'APROBADO') &&
    p.fechaVencimiento &&
    presupuestoDebeMarcarseVencido(p.estado, new Date(p.fechaVencimiento), ahora)
  ) {
    return 'VENCIDO'
  }

  return p.estado
}

/** Al guardar un borrador completo, pasa a pendiente (ENVIADO). */
export function estadoPresupuestoTrasGuardarCompleto(
  estadoActual: string,
  p: PresupuestoCompletitudInput,
): string | undefined {
  if (estadoActual !== 'BORRADOR') return undefined
  if (presupuestoEsIncompleto(p)) return undefined
  return 'ENVIADO'
}

export function esPresupuestoPendiente(p: PresupuestoCompletitudInput): boolean {
  return estadoPresupuestoParaUi(p) === 'ENVIADO'
}
