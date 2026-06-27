export type TipoEventoAp =
  | 'OC_CREADA'
  | 'OC_APROBADA'
  | 'OC_RECEPCION'
  | 'FC_REGISTRADA'
  | 'VENCIMIENTO_CREADO'
  | 'PAGO'
  | 'FC_ANULADA'

export interface EventoHistorialAp {
  tipo: TipoEventoAp
  fecha: string
  monto?: number
  moneda?: string
  saldoAcumulado?: number
  referencia: string
  id: string
  href: string
}

export interface KpisHistorialAp {
  deudaGenerada: number
  pagada: number
  pendienteHoy: number
  moneda: string
}

export interface HistorialApResult {
  eventos: EventoHistorialAp[]
  saldosPorMoneda: Record<string, number>
  kpis: KpisHistorialAp[]
}

const LABEL_TIPO: Record<TipoEventoAp, string> = {
  OC_CREADA: 'OC creada',
  OC_APROBADA: 'OC aprobada',
  OC_RECEPCION: 'Recepción mercadería',
  FC_REGISTRADA: 'Factura registrada',
  VENCIMIENTO_CREADO: 'Vencimiento AP',
  PAGO: 'Pago a proveedor',
  FC_ANULADA: 'Factura anulada',
}

export function labelEventoAp(tipo: TipoEventoAp): string {
  return LABEL_TIPO[tipo]
}
