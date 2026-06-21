import type { LayoutElement, LayoutElementType } from './types'
import { crearIdElemento } from './layout-default-presupuesto'

export interface PaletteItem {
  type: LayoutElementType
  titulo: string
  descripcion: string
  categoria: 'documento' | 'emisor' | 'cliente' | 'items' | 'totales' | 'forma' | 'compuesto'
  defaults: Partial<LayoutElement>
}

export const PALETTE_PLANTILLA: PaletteItem[] = [
  {
    type: 'field',
    titulo: 'Fecha',
    descripcion: 'Fecha de emisión',
    categoria: 'documento',
    defaults: { binding: 'documento.fecha', label: 'Fecha: ', width: 50, height: 5, style: { fontSize: 8 } },
  },
  {
    type: 'field',
    titulo: 'Nº documento',
    descripcion: 'Presupuesto / factura Nº',
    categoria: 'documento',
    defaults: {
      binding: 'documento.titulo',
      width: 80,
      height: 5,
      style: { fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
    },
  },
  {
    type: 'field',
    titulo: 'Leyenda no fiscal',
    descripcion: 'Texto legal',
    categoria: 'documento',
    defaults: {
      binding: 'documento.leyendaNoFiscal',
      width: 182,
      height: 5,
      style: { fontSize: 9, textAlign: 'center' },
    },
  },
  {
    type: 'image',
    titulo: 'Logo',
    descripcion: 'Logo del emisor',
    categoria: 'emisor',
    defaults: { binding: 'emisor.logo', content: '/logo.png', width: 40, height: 16 },
  },
  {
    type: 'field',
    titulo: 'Razón social',
    descripcion: 'Nombre comercial',
    categoria: 'emisor',
    defaults: {
      binding: 'documento.marca',
      width: 182,
      height: 6,
      style: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
    },
  },
  {
    type: 'field',
    titulo: 'Domicilio emisor',
    descripcion: 'Dirección fiscal',
    categoria: 'emisor',
    defaults: { binding: 'emisor.domicilio', width: 182, height: 5, style: { fontSize: 8, textAlign: 'center' } },
  },
  {
    type: 'field',
    titulo: 'Contacto emisor',
    descripcion: 'Teléfono y mail',
    categoria: 'emisor',
    defaults: { binding: 'emisor.contacto', width: 182, height: 5, style: { fontSize: 8, textAlign: 'center' } },
  },
  {
    type: 'fiscalRow',
    titulo: 'Fila fiscal',
    descripcion: 'CUIT, IIBB, inicio, IVA',
    categoria: 'compuesto',
    defaults: { width: 182, height: 9, style: { fontSize: 7 } },
  },
  {
    type: 'clienteBox',
    titulo: 'Datos cliente',
    descripcion: 'Recuadro cliente 2 columnas',
    categoria: 'cliente',
    defaults: { width: 182, height: 24, style: { fontSize: 8 } },
  },
  {
    type: 'itemsTable',
    titulo: 'Tabla ítems',
    descripcion: 'Productos y precios',
    categoria: 'items',
    defaults: { width: 182, height: 90, style: { fontSize: 8, backgroundColor: '#E8650A', color: '#fff' } },
  },
  {
    type: 'totalsBox',
    titulo: 'Totales',
    descripcion: 'Subtotal, bonif., total',
    categoria: 'totales',
    defaults: { width: 76, height: 32, style: { fontSize: 8 } },
  },
  {
    type: 'field',
    titulo: 'Importe en letras',
    descripcion: 'SON pesos…',
    categoria: 'totales',
    defaults: { binding: 'totales.enLetras', width: 182, height: 8, style: { fontSize: 7 } },
  },
  {
    type: 'observacionesBlock',
    titulo: 'Observaciones',
    descripcion: 'Vigencia, pago, garantía',
    categoria: 'compuesto',
    defaults: { width: 182, height: 40, label: 'Observaciones:', style: { fontSize: 8 } },
  },
  {
    type: 'text',
    titulo: 'Texto fijo',
    descripcion: 'Texto estático',
    categoria: 'forma',
    defaults: { content: 'Texto', width: 60, height: 5, style: { fontSize: 8 } },
  },
  {
    type: 'line',
    titulo: 'Línea',
    descripcion: 'Separador horizontal',
    categoria: 'forma',
    defaults: { width: 182, height: 1, style: { borderColor: '#000', borderWidth: 1 } },
  },
  {
    type: 'rect',
    titulo: 'Rectángulo',
    descripcion: 'Marco o fondo',
    categoria: 'forma',
    defaults: { width: 80, height: 20, style: { borderColor: '#E8650A', borderWidth: 1 } },
  },
  {
    type: 'field',
    titulo: 'Campo cliente',
    descripcion: 'Campo suelto de cliente',
    categoria: 'cliente',
    defaults: { binding: 'cliente.nombre', label: 'Cliente: ', width: 120, height: 5, style: { fontSize: 8 } },
  },
  {
    type: 'field',
    titulo: 'Total',
    descripcion: 'Importe total',
    categoria: 'totales',
    defaults: { binding: 'totales.total', label: 'Total: ', width: 60, height: 5, style: { fontSize: 10, fontWeight: 'bold' } },
  },
]

export function elementoDesdePalette(item: PaletteItem, x: number, y: number): LayoutElement {
  return {
    id: crearIdElemento(),
    type: item.type,
    x,
    y,
    width: item.defaults.width ?? 60,
    height: item.defaults.height ?? 5,
    binding: item.defaults.binding,
    label: item.defaults.label,
    content: item.defaults.content,
    columns: item.defaults.columns,
    style: item.defaults.style,
    visible: true,
    zIndex: 10,
  }
}

export const CATEGORIA_LABEL: Record<PaletteItem['categoria'], string> = {
  documento: 'Documento',
  emisor: 'Emisor',
  cliente: 'Cliente',
  items: 'Ítems',
  totales: 'Totales',
  forma: 'Formas',
  compuesto: 'Bloques',
}
