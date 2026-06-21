/**
 * Tipos del motor de plantillas JSON (Fase 3).
 */

export interface ColumnaItem {
  key: string
  label: string
  visible: boolean
  anchoPct: number
  /** Máximo de caracteres; 0 = sin límite */
  maxChars?: number
  /** Cómo tratar texto que excede el límite o el ancho */
  overflow?: 'wrap' | 'truncate' | 'ellipsis'
  /** Tope de líneas visibles (solo con wrap); 0 = sin tope */
  maxLineas?: number
  fontSize?: number
}

export type TextOverflow = 'wrap' | 'truncate' | 'ellipsis'

export type LayoutElementType =
  | 'text'
  | 'field'
  | 'image'
  | 'line'
  | 'rect'
  | 'fiscalRow'
  | 'clienteBox'
  | 'itemsTable'
  | 'totalsBox'
  | 'observacionesBlock'

export interface LayoutElementStyle {
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  color?: string
  backgroundColor?: string
  textAlign?: 'left' | 'center' | 'right'
  borderColor?: string
  borderWidth?: number
  /** Máximo de caracteres para campos de texto */
  maxChars?: number
  overflow?: TextOverflow
  maxLineas?: number
}

export interface LayoutElement {
  id: string
  type: LayoutElementType
  /** Posición desde borde superior-izquierdo de la página (mm) */
  x: number
  y: number
  width: number
  height: number
  style?: LayoutElementStyle
  /** Campo de datos, p.ej. emisor.razonSocial, documento.numero, totales.total */
  binding?: string
  /** Prefijo visible en campos, p.ej. "Cliente: " */
  label?: string
  /** Texto estático (type=text) o URL de imagen */
  content?: string
  /** Columnas para itemsTable; si omitido usa cfg.items.columnas */
  columns?: ColumnaItem[]
  visible?: boolean
  zIndex?: number
}

export interface PlantillaLayout {
  unidad: 'mm'
  anchoPagina: number
  altoPagina: number
  elementos: LayoutElement[]
}

export interface PlantillaConfig {
  id?: string
  version: number
  tipo: 'FACTURA' | 'PRESUPUESTO' | 'REMITO' | 'NOTA_CREDITO' | 'NOTA_DEBITO'
  papel: 'A4' | 'LETTER'
  estilo: {
    fuente: string
    colorMarca: string
    margenMm: number
  }
  encabezado: {
    mostrarLogo: boolean
    campos: string[]
    leyenda?: string
  }
  cliente: {
    campos: string[]
  }
  items: {
    columnas: ColumnaItem[]
  }
  totales: {
    mostrarNeto: boolean
    mostrarBonificacion: boolean
    discriminarIva: boolean
  }
  importeEnLetras: boolean
  observaciones: {
    camposFijos: string[]
    textoLibre: boolean
    leyendaNoFiscal?: string
  }
  pieFiscal: {
    cae: boolean
    qr: boolean
  }
  /** Layout visual por bloques posicionados; si presente, tiene prioridad sobre render legacy */
  layout?: PlantillaLayout
  /** Plantilla HTML con placeholders {{campo}}; tiene prioridad sobre layout/react-pdf */
  html?: string
}

export interface DatosEmisorDoc {
  razonSocial: string
  cuit: string
  condicionIva: string
  ingresosBrutos?: string | null
  inicioActividades?: string | null
  domicilio?: string | null
  telefono?: string | null
  email?: string | null
}

export interface DatosClienteDoc {
  nombre: string
  direccion?: string | null
  cuit?: string | null
  condicionIva?: string | null
  condicionPago?: string | null
  direccionEntrega?: string | null
  vendedor?: string | null
  ordenCompra?: string | null
  deposito?: string | null
}

export interface ItemDocumentoRender {
  codigo?: string | null
  descripcion: string
  descripcionLarga?: string | null
  fotoUrl?: string | null
  cantidad: number
  precioUnit: number
  bonificacionPct?: number
  subtotal: number
}

export interface DatosDocumentoRender {
  tipo: 'FACTURA' | 'PRESUPUESTO' | 'REMITO'
  numero: string
  tipoFactura?: 'A' | 'B' | 'C'
  fechaEmision: string
  moneda?: string
  cotizacionUsd?: number | null
  emisor: DatosEmisorDoc
  cliente: DatosClienteDoc
  items: ItemDocumentoRender[]
  subtotal: number
  iva: number
  total: number
  bonificacionPct?: number
  observaciones?: string | null
  /** Plazos de cobranza del documento (ej. «30-60-90 días»), distinto de la condición habitual del cliente */
  condicionPago?: string | null
  formaPago?: string | null
  plazoEntrega?: string | null
  garantia?: string | null
  vigenciaDias?: number
  tasaFinanciacionPct?: number
  interesFinanciacion?: number
  presupuestoNumero?: string | null
  cae?: string | null
  caeVencimiento?: string | null
  qrDataUrl?: string | null
}
