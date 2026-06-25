export type EtapaKey =
  | 'ENTRADA'
  | 'CONTACTO'
  | 'DOCUMENTACION'
  | 'PROPUESTA'
  | 'SEGUIMIENTO'
  | 'ANALISIS'
  | 'ENTREGA'
  | 'CIERRE'
  | 'PERDIDO'

export interface EtapaDef {
  key: EtapaKey
  label: string
  color: string
  order: number
  /** No forma parte del pipeline activo (cerrado / perdido) */
  terminal?: boolean
}

export const ETAPAS: EtapaDef[] = [
  { key: 'ENTRADA',       label: 'Entrada',        color: '#6c757d', order: 0 },
  { key: 'CONTACTO',      label: 'Contacto',       color: '#0d6efd', order: 1 },
  { key: 'DOCUMENTACION', label: 'Documentación',  color: '#6610f2', order: 2 },
  { key: 'PROPUESTA',     label: 'Propuesta',      color: '#fd7e14', order: 3 },
  { key: 'SEGUIMIENTO',   label: 'Seguimiento',    color: '#ffc107', order: 4 },
  { key: 'ANALISIS',      label: 'Análisis',       color: '#20c997', order: 5 },
  { key: 'ENTREGA',       label: 'Entrega',        color: '#0dcaf0', order: 6 },
  { key: 'CIERRE',        label: 'Cierre',         color: '#198754', order: 7, terminal: true },
  { key: 'PERDIDO',       label: 'Perdido',        color: '#dc3545', order: 8, terminal: true },
]

export const ETAPA_MAP = Object.fromEntries(ETAPAS.map((e) => [e.key, e])) as Record<EtapaKey, EtapaDef>

export const VENDEDORES = ['GA', 'LB', 'BR'] as const
export type VendedorKey = (typeof VENDEDORES)[number] | 'OTRO'

export const VENDEDOR_COLORS: Record<string, string> = {
  GA: '#0d6efd',
  LB: '#6610f2',
  BR: '#fd7e14',
  OTRO: '#6c757d',
}

export function etapaOrder(key: EtapaKey): number {
  return ETAPA_MAP[key]?.order ?? 0
}

export function etapaLabel(key: EtapaKey): string {
  return ETAPA_MAP[key]?.label ?? key
}

export function transitionKey(desde: EtapaKey, hasta: EtapaKey): string {
  return `${desde}->${hasta}`
}

export function isForwardMove(desde: EtapaKey, hasta: EtapaKey): boolean {
  return etapaOrder(hasta) > etapaOrder(desde)
}

export function isAdjacentForward(desde: EtapaKey, hasta: EtapaKey): boolean {
  return etapaOrder(hasta) === etapaOrder(desde) + 1
}
