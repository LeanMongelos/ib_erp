// Tipos globales del sistema ERP Ingeniería Biomédica

export type Rol = 'ADMIN' | 'TECNICO' | 'VENTAS' | 'FACTURACION'

export type TipoCliente = 'HOSPITAL' | 'CLINICA' | 'CONSULTORIO' | 'SANATORIO' | 'OTRO'

export type EstadoEquipo = 'ACTIVO' | 'EN_REPARACION' | 'BAJA'

export type TipoOT = 'CORRECTIVO' | 'PREVENTIVO' | 'INSTALACION' | 'CALIBRACION' | 'GARANTIA'

export type TipoArticuloInventario = 'REPUESTO' | 'CONSUMIBLE' | 'ACCESORIO' | 'BATERIA' | 'EQUIPO' | 'ALQUILER'

export type EstadoOT = 'ABIERTA' | 'EN_PROCESO' | 'CERRADA' | 'VENCIDA' | 'CANCELADA'

export type Prioridad = 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE'

export type EstadoTicket =
  | 'ABIERTA'
  | 'EN_REVISION'
  | 'EN_PROGRESO'
  | 'ESPERANDO_INFO'
  | 'RESUELTA'
  | 'CERRADA'
  | 'CANCELADA'

export type TipoFactura = 'A' | 'B' | 'C'

export type EstadoFactura = 'BORRADOR' | 'PENDIENTE' | 'PENDIENTE_CAE' | 'EMITIDA' | 'RECHAZADA' | 'PAGADA' | 'VENCIDA' | 'ANULADA'
export type EstadoPresupuesto = 'BORRADOR' | 'ENVIADO' | 'APROBADO' | 'RECHAZADO' | 'VENCIDO' | 'CONVERTIDO'

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  creadoEn: string
}

export interface Cliente {
  id: string
  nombre: string
  tipo: TipoCliente
  cuit?: string | null
  direccion?: string | null
  ciudad?: string | null
  telefono?: string | null
  email?: string | null
  contacto?: string | null
  activo: boolean
  creadoEn: string
  // Ficha 360°
  condicionIva?: string | null
  condicionPago?: string | null
  limiteCredito?: number | null
  segmento?: string | null
  sitioWeb?: string | null
  notas?: string | null
  alicuotaIvaId?: string | null
  alicuotaIva?: { id: string; nombre: string; porcentaje: number } | null
  listaPreciosId?: string | null
  esMayorista?: boolean
  monedaPreferida?: string | null
  _count?: {
    equipos: number
    ots: number
  }
}

export interface ContactoCliente {
  id: string
  clienteId: string
  nombre: string
  cargo?: string | null
  email?: string | null
  telefono?: string | null
  principal: boolean
  creadoEn: string
}

// ============ PROVEEDORES ============

export type OrigenProveedor = 'NACIONAL' | 'IMPORTADO'
export type TipoCompraProveedor = 'REMITO' | 'CONCEPTOS' | 'AMBOS'

export type TipoFacturaCompra = 'REMITO' | 'CONCEPTOS'

export type EstadoFacturaCompra = 'BORRADOR' | 'REGISTRADA' | 'ANULADA'

export interface ContactoProveedor {
  id: string
  proveedorId: string
  nombre: string
  cargo?: string | null
  email?: string | null
  telefono?: string | null
  whatsapp?: string | null
  principal: boolean
  creadoEn: string
}

export interface CondicionComercialProveedor {
  id: string
  proveedorId: string
  descripcion: string
  plazoDias: number
  recargoPct: number
  descuentoPct: number
}

export interface ProveedorProducto {
  id: string
  proveedorId: string
  inventarioId?: string | null
  nombreProducto: string
  costo: number
  bonificacionPct?: number
  moneda: string
  leadTimeDias?: number | null
  garantiaMeses?: number | null
  vigenteDesde: string
  creadoEn: string
  inventario?: { id: string; nombre: string; sku?: string | null } | null
}

export interface Proveedor {
  id: string
  razonSocial: string
  cuit?: string | null
  condicionIva?: string | null
  rubro?: string | null
  origen: OrigenProveedor
  tipoCompra: TipoCompraProveedor
  moneda: string
  email?: string | null
  telefono?: string | null
  sitioWeb?: string | null
  direccion?: string | null
  ciudad?: string | null
  marcas?: string | null
  condicionPago?: string | null
  financiacionPct?: number | null
  plazoEntregaDias?: number | null
  minimoCompra?: number | null
  notas?: string | null
  activo: boolean
  creadoEn: string
  contactos?: ContactoProveedor[]
  condiciones?: CondicionComercialProveedor[]
  productos?: ProveedorProducto[]
  _count?: {
    productos: number
    contactos: number
  }
}

export interface Equipo {
  id: string
  nombre: string
  marca?: string | null
  modelo?: string | null
  numeroSerie?: string | null
  garantiaHasta?: string | null
  estado: EstadoEquipo
  origen?: string | null
  notasTecnicas?: string | null
  clienteId: string
  cliente?: Cliente
  creadoEn: string
}

export interface RepuestoOT {
  id: string
  descripcion: string
  cantidad: number
  precioUnit: number
  otId: string
  inventarioId?: string | null
}

export interface HistorialOT {
  id: string
  estado: EstadoOT
  nota?: string | null
  otId: string
  creadoEn: string
}

export interface OrdenTrabajo {
  id: string
  numero: string
  descripcion: string
  diagnostico?: string | null
  tipo: TipoOT
  estado: EstadoOT
  prioridad: Prioridad
  slaHoras: number
  fechaApertura: string
  fechaCierre?: string | null
  slaVence: string
  clienteId: string
  equipoId?: string | null
  tecnicoId?: string | null
  creadoEn: string
  cliente?: Cliente
  equipo?: Equipo
  tecnico?: Usuario
  repuestos?: RepuestoOT[]
  historial?: HistorialOT[]
}

export interface ItemFactura {
  id: string
  descripcion: string
  cantidad: number
  precioUnit: number
  subtotal: number
  facturaId: string
  inventarioId?: string | null
  numeroSerie?: string | null
  proximoPreventivo?: string | null
  equipoGeneradoId?: string | null
}

export interface ItemPresupuesto {
  id: string
  descripcion: string
  cantidad: number
  precioUnit: number
  subtotal: number
  presupuestoId: string
  inventarioId?: string | null
  numeroSerie?: string | null
  proximoPreventivo?: string | null
}

export interface Factura {
  id: string
  numero: string
  tipo: TipoFactura
  estado: EstadoFactura
  fechaEmision: string
  fechaVencimiento?: string | null
  subtotal: number
  iva: number
  total: number
  clienteId: string
  otId?: string | null
  creadoEn: string
  cliente?: Cliente
  ot?: OrdenTrabajo
  items?: ItemFactura[]
}

export interface Inventario {
  id: string
  nombre: string
  descripcion?: string | null
  sku?: string | null
  tipoArticulo?: TipoArticuloInventario
  marca?: string | null
  modelo?: string | null
  esSerializado?: boolean
  requierePreventivo?: boolean
  intervaloPreventivoDias?: number | null
  stock: number
  stockMinimo: number
  precioUnit?: number | null
  categoria?: string | null
  activo: boolean
  creadoEn: string
}

export interface DashboardStats {
  otsAbiertas: number
  otsVencidas: number
  clientesActivos: number
  facturasPendientesMonto: number
  otsPorMes: { mes: string; cantidad: number }[]
  otsPorEstado: { estado: EstadoOT; cantidad: number }[]
  ultimasOTs: OrdenTrabajo[]
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
