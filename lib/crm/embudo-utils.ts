import { formatImporteAr } from '@/lib/plantillas/format-importe'
import type { EtapaKey } from './embudo-constants'
import { etapaLabel } from './embudo-constants'

/** Formato spec: ARS 1.234.567,89 */
export function formatEmbudoMonto(monto: number | null | undefined): string {
  const f = formatImporteAr(monto ?? 0)
  return `ARS ${f.slice(1)}`
}

export function diasEnEtapa(etapaDesde: string | Date): number {
  const desde = typeof etapaDesde === 'string' ? new Date(etapaDesde) : etapaDesde
  const diff = Date.now() - desde.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export type AlertaTarjeta = 'rojo' | 'naranja' | 'amarillo' | null

export function alertaTarjeta(etapaDesde: string | Date, proximaAccionFecha?: string | null): AlertaTarjeta {
  const dias = diasEnEtapa(etapaDesde)
  if (dias > 15) return 'rojo'

  if (proximaAccionFecha) {
    const hoy = startOfDay(new Date())
    const manana = addDays(hoy, 1)
    const fecha = startOfDay(new Date(proximaAccionFecha))
    if (fecha.getTime() === hoy.getTime()) return 'naranja'
    if (fecha.getTime() === manana.getTime()) return 'amarillo'
  }

  return null
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface NegocioEmbudoDTO {
  id: string
  numero: number
  nombre: string
  cliente: string
  monto: number
  vendedor: string
  urgencia: 'NORMAL' | 'URGENTE'
  etapa: EtapaKey
  etapaDesde: string
  proximaAccionFecha?: string | null
  productoServicio?: string | null
  notas?: string | null
  presupuestoId?: string | null
  presupuestoNumero?: string | null
}

export interface EmbudoStats {
  totalActivos: number
  pipelineArs: number
  cerradosMes: number
  ticketPromedio: number
}

export function calcularStats(negocios: NegocioEmbudoDTO[]): EmbudoStats {
  const activos = negocios.filter((n) => n.etapa !== 'CIERRE')
  const pipelineArs = activos.reduce((s, n) => s + (n.monto ?? 0), 0)
  const ahora = new Date()
  const cerradosMes = negocios.filter((n) => {
    if (n.etapa !== 'CIERRE') return false
    const d = new Date(n.etapaDesde)
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear()
  }).length
  const ticketPromedio = activos.length > 0 ? pipelineArs / activos.length : 0
  return {
    totalActivos: activos.length,
    pipelineArs,
    cerradosMes,
    ticketPromedio,
  }
}

export function historialEtiqueta(desde: EtapaKey, hasta: EtapaKey, retroceso: boolean): string {
  if (retroceso) return `${etapaLabel(desde)} → ${etapaLabel(hasta)} (retroceso)`
  return `${etapaLabel(desde)} → ${etapaLabel(hasta)}`
}
