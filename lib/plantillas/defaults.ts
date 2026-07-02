import type { PlantillaConfig } from './types'
import { HTML_PLANTILLA_FACTURA, HTML_PLANTILLA_PRESUPUESTO, HTML_PLANTILLA_REMITO } from './html-templates'

const COLUMNAS_ITEMS = [
  { key: 'codigo', label: 'Producto', visible: true, anchoPct: 12, maxChars: 24, overflow: 'truncate' as const },
  {
    key: 'descripcion',
    label: 'Descripción',
    visible: true,
    anchoPct: 38,
    maxChars: 2500,
    overflow: 'wrap' as const,
    fontSize: 8,
  },
  { key: 'foto', label: '', visible: true, anchoPct: 10 },
  { key: 'cantidad', label: 'Cantidad', visible: true, anchoPct: 10, maxChars: 12, overflow: 'truncate' as const },
  { key: 'precioUnit', label: 'Precio', visible: true, anchoPct: 15, maxChars: 18, overflow: 'truncate' as const },
  { key: 'subtotal', label: 'Sub total', visible: true, anchoPct: 15, maxChars: 18, overflow: 'truncate' as const },
]

export const PLANTILLA_PRESUPUESTO_DEFAULT: PlantillaConfig = {
  version: 1,
  tipo: 'PRESUPUESTO',
  papel: 'A4',
  estilo: { fuente: 'Helvetica', colorMarca: '#E8650A', margenMm: 14 },
  encabezado: {
    mostrarLogo: true,
    campos: ['razonSocial', 'cuit', 'condicionIva', 'ingresosBrutos', 'inicioActividades', 'domicilio', 'telefono', 'email'],
    leyenda: 'INGENIERIA BIOMEDICA',
  },
  cliente: {
    campos: ['nombre', 'direccion', 'cuit', 'condicionIva', 'condicionPago'],
  },
  items: { columnas: COLUMNAS_ITEMS },
  totales: { mostrarNeto: true, mostrarBonificacion: true, discriminarIva: true },
  importeEnLetras: true,
  observaciones: {
    camposFijos: ['vigencia', 'formaPago', 'plazosCobranza', 'tasaFinanciacion', 'plazoEntrega', 'garantia'],
    textoLibre: true,
    leyendaNoFiscal: 'documento no válido como factura',
  },
  pieFiscal: { cae: false, qr: false },
  // La factura/presupuesto/remito usan su HTML dedicado, no el layout de bloques.
  layout: undefined,
  html: HTML_PLANTILLA_PRESUPUESTO,
}

export const PLANTILLA_FACTURA_DEFAULT: PlantillaConfig = {
  ...PLANTILLA_PRESUPUESTO_DEFAULT,
  tipo: 'FACTURA',
  // La factura usa su HTML fiscal dedicado (formato AFIP), no el layout de bloques
  // del presupuesto: el layout tiene prioridad sobre el HTML en renderDocumentoPDF.
  layout: undefined,
  html: HTML_PLANTILLA_FACTURA,
  observaciones: {
    camposFijos: ['formaPago', 'plazosCobranza', 'tasaFinanciacion', 'plazoEntrega'],
    textoLibre: true,
    leyendaNoFiscal: undefined,
  },
  pieFiscal: { cae: true, qr: true },
  items: {
    columnas: COLUMNAS_ITEMS.map((c) => (c.key === 'foto' ? { ...c, visible: false } : c)),
  },
}

export const PLANTILLA_REMITO_DEFAULT: PlantillaConfig = {
  ...PLANTILLA_PRESUPUESTO_DEFAULT,
  tipo: 'REMITO',
  html: HTML_PLANTILLA_REMITO,
  observaciones: {
    camposFijos: ['plazoEntrega'],
    textoLibre: true,
    leyendaNoFiscal: undefined,
  },
  pieFiscal: { cae: false, qr: false },
  items: {
    columnas: COLUMNAS_ITEMS.map((c) =>
      c.key === 'precioUnit' || c.key === 'subtotal'
        ? { ...c, visible: false }
        : c,
    ),
  },
  totales: { mostrarNeto: false, mostrarBonificacion: false, discriminarIva: false },
  importeEnLetras: false,
}

export const PLANTILLA_DEFAULT_POR_TIPO: Record<'FACTURA' | 'PRESUPUESTO' | 'REMITO', PlantillaConfig> = {
  FACTURA: PLANTILLA_FACTURA_DEFAULT,
  PRESUPUESTO: PLANTILLA_PRESUPUESTO_DEFAULT,
  REMITO: PLANTILLA_REMITO_DEFAULT,
}
