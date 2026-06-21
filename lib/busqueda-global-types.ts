export type TipoResultadoBusqueda =
  | 'cliente'
  | 'factura'
  | 'presupuesto'
  | 'producto'
  | 'equipo'
  | 'ot'
  | 'proveedor'

export interface ResultadoBusqueda {
  id: string
  tipo: TipoResultadoBusqueda
  titulo: string
  subtitulo?: string
  href: string
}

export const ETIQUETAS_TIPO: Record<TipoResultadoBusqueda, string> = {
  cliente: 'Clientes',
  factura: 'Facturas',
  presupuesto: 'Presupuestos',
  producto: 'Productos',
  equipo: 'Equipos',
  ot: 'Órdenes de trabajo',
  proveedor: 'Proveedores',
}
