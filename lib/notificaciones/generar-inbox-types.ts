export type PrioridadAlerta = 'urgente' | 'importante' | 'info'
export type CategoriaAlerta =
  | 'cobranza'
  | 'ot'
  | 'preventivo'
  | 'componente'
  | 'inventario'
  | 'presupuesto'
  | 'factura'
  | 'crm'

export interface AlertaInbox {
  clave: string
  categoria: CategoriaAlerta
  prioridad: PrioridadAlerta
  titulo: string
  mensaje: string
  href: string
  fecha: string
}
