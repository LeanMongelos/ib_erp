import type { TipoEventoOC } from '@prisma/client'

export type PasoOcEstado = 'pendiente' | 'activo' | 'completo' | 'rechazado' | 'omitido'

export interface PasoOcTimeline {
  id: string
  label: string
  estado: PasoOcEstado
  detalle?: string
}

export interface EventoOcTimeline {
  id: string
  tipo: TipoEventoOC
  fecha: string
  referencia: string | null
  usuario?: { id: string; nombre: string } | null
  payload?: unknown
  href: string
}

export interface TimelineOcResult {
  ordenCompraId: string
  numero: string
  estado: string
  cumplimientoPct: number
  pasos: PasoOcTimeline[]
  eventos: EventoOcTimeline[]
}

const LABEL_EVENTO: Record<TipoEventoOC, string> = {
  OC_CREADA: 'Orden de compra generada',
  OC_ENVIADA_APROBACION: 'Enviada a aprobación',
  OC_REENVIADA: 'Reenviada a aprobación',
  OC_APROBADA: 'OC aprobada',
  OC_RECHAZADA: 'OC rechazada',
  OC_RECEPCION_PARCIAL: 'Recepción parcial',
  OC_RECEPCION_COMPLETA: 'Recepción completa',
  OC_FC_REGISTRADA: 'Factura de compra registrada',
  OC_FC_ANULADA: 'Factura de compra anulada',
  OC_PAGO_PARCIAL: 'Pago parcial a proveedor',
  OC_PAGO_COMPLETO: 'Pago completo — deuda saldada',
  OC_CANCELADA: 'OC cancelada',
}

export function labelEventoOc(tipo: TipoEventoOC): string {
  return LABEL_EVENTO[tipo] ?? tipo
}
