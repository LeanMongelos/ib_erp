/**
 * Plantilla e importación masiva de inventario (Excel .xlsx).
 * Formato principal: Action Sales (columnas en español).
 * Formato legacy: hoja "productos" con columnas en inglés/snake_case.
 */
import * as XLSX from 'xlsx'
import { z } from 'zod'

/** Columnas idénticas al export Action Sales / catálogo comercial. */
export const ACTION_SALES_HEADERS = [
  'Código',
  'Descripción',
  'Descripción adicional',
  'IVA(%)',
  'Descuento',
  'Código de barras',
  'Sinónimo',
  'Perfil',
  'Archivo',
] as const

export const INVENTARIO_EXCEL_HEADERS = [
  'nombre',
  'sku',
  'descripcion',
  'categoria',
  'tipo_articulo',
  'marca',
  'modelo',
  'es_serializado',
  'requiere_preventivo',
  'intervalo_preventivo_dias',
  'stock',
  'stock_minimo',
  'stock_maximo',
  'punto_pedido',
  'precio_unit',
  'alicuota_iva_pct',
] as const

export const KIT_EXCEL_HEADERS = [
  'parent_sku',
  'child_sku',
  'nombre',
  'cantidad',
  'tipo_item',
  'tipo_componente',
] as const

const ejemploActionSales = {
  'Código': 'HOE001',
  'Descripción': 'Aerocámara adulto PA05',
  'Descripción adicional': 'Marca: Silfab',
  'IVA(%)': 21,
  'Descuento': 0,
  'Código de barras': '',
  'Sinónimo': '',
  'Perfil': 'COMPRAS - VENTAS',
  'Archivo': '',
}

const tipoArticuloEnum = z.enum(['REPUESTO', 'CONSUMIBLE', 'ACCESORIO', 'BATERIA', 'EQUIPO'])
const tipoItemKitEnum = z.enum(['ACCESORIO_ESPECIFICO', 'ACCESORIO_GENERICO', 'BATERIA', 'COMPONENTE', 'REPUESTO_INCLUIDO'])
const tipoComponenteEnum = z.enum(['BATERIA', 'FILTRO', 'CALIBRACION', 'SENSOR', 'OTRO'])

export const inventarioImportRowSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre obligatorio (mín. 2 caracteres)'),
  sku: z.string().trim().min(1).max(40),
  descripcion: z.string().trim().max(500).optional().nullable(),
  categoria: z.string().trim().max(60).optional().nullable(),
  tipoArticulo: tipoArticuloEnum.default('REPUESTO'),
  marca: z.string().trim().max(80).optional().nullable(),
  modelo: z.string().trim().max(80).optional().nullable(),
  esSerializado: z.boolean().default(false),
  requierePreventivo: z.boolean().default(false),
  intervaloPreventivoDias: z.number().int().positive().optional().nullable(),
  stock: z.number().int().nonnegative().default(0),
  stockMinimo: z.number().int().nonnegative().default(0),
  stockMaximo: z.number().int().positive().optional().nullable(),
  puntoPedido: z.number().int().nonnegative().optional().nullable(),
  precioUnit: z.number().nonnegative().optional().nullable(),
  alicuotaIvaPct: z.number().min(0).max(100).optional().nullable(),
  codigoBarras: z.string().trim().max(80).optional().nullable(),
  sinonimo: z.string().trim().max(120).optional().nullable(),
  descuentoPct: z.number().min(0).max(100).default(0),
  perfil: z.string().trim().max(80).optional().nullable(),
  archivoRef: z.string().trim().max(200).optional().nullable(),
  activo: z.boolean().default(true),
})

export const kitImportRowSchema = z.object({
  parentSku: z.string().trim().min(1, 'parent_sku obligatorio'),
  childSku: z.string().trim().max(40).optional().nullable(),
  nombre: z.string().trim().min(1, 'nombre obligatorio'),
  cantidad: z.number().int().positive().default(1),
  tipoItem: tipoItemKitEnum.default('ACCESORIO_ESPECIFICO'),
  tipoComponente: tipoComponenteEnum.optional().nullable(),
})

export type InventarioImportRow = z.infer<typeof inventarioImportRowSchema>
export type KitImportRow = z.infer<typeof kitImportRowSchema>

export interface InventarioWorkbookParse {
  productos: InventarioImportRow[]
  kits: KitImportRow[]
  formato: 'action_sales' | 'legacy'
}

function normalizarClave(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[%()]/g, '')
    .replace(/\s+/g, '_')
}

function parseNumero(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined
  if (typeof val === 'number' && Number.isFinite(val)) return val
  const s = String(val).trim().replace(',', '.')
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

function parseEntero(val: unknown, fallback: number): number {
  const n = parseNumero(val)
  if (n === undefined) return fallback
  return Math.max(0, Math.round(n))
}

function parseBool(val: unknown, fallback = false): boolean {
  if (val === null || val === undefined || val === '') return fallback
  if (typeof val === 'boolean') return val
  const s = String(val).trim().toLowerCase()
  if (['1', 'si', 'sí', 'true', 'yes', 'x'].includes(s)) return true
  if (['0', 'no', 'false'].includes(s)) return false
  return fallback
}

function filaEsEncabezado(row: Record<string, unknown>): boolean {
  const nombre = String(row.nombre ?? row.descripcion ?? row.parent_sku ?? '').trim().toLowerCase()
  return nombre === 'nombre' || nombre === 'descripcion' || nombre === 'parent_sku' || nombre === 'ejemplo' || nombre.startsWith('*')
}

function parseDescripcionAdicional(text: string): { marca?: string; descripcion?: string } {
  const t = text.trim()
  if (!t) return {}
  const marcaMatch = t.match(/^Marca:\s*(.+)$/i)
  if (marcaMatch) {
    return { marca: marcaMatch[1].trim(), descripcion: t }
  }
  return { descripcion: t }
}

function inferirTipoArticulo(codigo: string, nombre: string, perfil: string | null): z.infer<typeof tipoArticuloEnum> {
  const n = nombre.toLowerCase()
  const c = codigo.toUpperCase()
  if (n.includes('desfibr') || n.includes('monitor') || n.includes('ventilador') || n.includes('bomba de infusi')) {
    return 'EQUIPO'
  }
  if (c.startsWith('SERV') || n.includes('servicio') || n.includes('mano de obra') || perfil === 'VENTAS') {
    return 'CONSUMIBLE'
  }
  return 'REPUESTO'
}

function esFormatoActionSales(row: Record<string, unknown>): boolean {
  const keys = Object.keys(row).map(normalizarClave)
  return keys.includes('codigo') && keys.includes('descripcion')
}

function mapFilaActionSales(raw: Record<string, unknown>): InventarioImportRow | null {
  const mapped: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    mapped[normalizarClave(k)] = v
  }

  const codigo = String(mapped.codigo ?? '').trim()
  const nombre = String(mapped.descripcion ?? '').trim()
  if (!codigo || !nombre || filaEsEncabezado({ descripcion: nombre } as Record<string, unknown>)) return null

  const descAdicional = String(mapped.descripcion_adicional ?? '').trim()
  const { marca, descripcion } = parseDescripcionAdicional(descAdicional)
  const perfil = String(mapped.perfil ?? '').trim() || null
  const activo = perfil?.toUpperCase() !== 'INHABILITADO'

  const parsed = inventarioImportRowSchema.safeParse({
    nombre,
    sku: codigo,
    descripcion: descripcion ?? (descAdicional || null),
    marca: marca ?? null,
    categoria: perfil,
    tipoArticulo: inferirTipoArticulo(codigo, nombre, perfil),
    stock: 0,
    stockMinimo: 0,
    alicuotaIvaPct: parseNumero(mapped.iva) ?? 21,
    descuentoPct: parseNumero(mapped.descuento) ?? 0,
    codigoBarras: String(mapped.codigo_de_barras ?? '').trim() || null,
    sinonimo: String(mapped.sinonimo ?? '').trim() || null,
    perfil,
    archivoRef: String(mapped.archivo ?? '').trim() || null,
    activo,
  })

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Fila inválida'
    throw new Error(`${codigo}: ${msg}`)
  }
  return parsed.data
}

function mapFilaLegacy(raw: Record<string, unknown>): InventarioImportRow | null {
  const mapped: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    mapped[normalizarClave(k)] = v
  }

  const nombre = String(mapped.nombre ?? '').trim()
  if (!nombre || filaEsEncabezado(mapped as Record<string, unknown>)) return null

  const sku = String(mapped.sku ?? '').trim()
  if (!sku) return null

  const tipoRaw = String(mapped.tipo_articulo ?? 'REPUESTO').trim().toUpperCase()

  const parsed = inventarioImportRowSchema.safeParse({
    nombre,
    sku,
    descripcion: mapped.descripcion ? String(mapped.descripcion).trim() : null,
    categoria: mapped.categoria ? String(mapped.categoria).trim() : null,
    tipoArticulo: tipoRaw || 'REPUESTO',
    marca: mapped.marca ? String(mapped.marca).trim() : null,
    modelo: mapped.modelo ? String(mapped.modelo).trim() : null,
    esSerializado: parseBool(mapped.es_serializado),
    requierePreventivo: parseBool(mapped.requiere_preventivo),
    intervaloPreventivoDias: parseNumero(mapped.intervalo_preventivo_dias) ?? null,
    stock: parseEntero(mapped.stock, 0),
    stockMinimo: parseEntero(mapped.stock_minimo, 5),
    stockMaximo: parseNumero(mapped.stock_maximo) ?? null,
    puntoPedido: parseNumero(mapped.punto_pedido) ?? null,
    precioUnit: parseNumero(mapped.precio_unit) ?? null,
    alicuotaIvaPct: parseNumero(mapped.alicuota_iva_pct) ?? null,
    activo: true,
  })

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Fila inválida'
    throw new Error(`${nombre}: ${msg}`)
  }
  return parsed.data
}

function mapKitFilaRaw(raw: Record<string, unknown>): KitImportRow | null {
  const mapped: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    mapped[normalizarClave(k)] = v
  }

  const parentSku = String(mapped.parent_sku ?? '').trim()
  if (!parentSku || filaEsEncabezado(mapped as Record<string, unknown>)) return null

  const tipoCompRaw = String(mapped.tipo_componente ?? '').trim().toUpperCase()
  const parsed = kitImportRowSchema.safeParse({
    parentSku,
    childSku: mapped.child_sku ? String(mapped.child_sku).trim() : null,
    nombre: String(mapped.nombre ?? mapped.child_sku ?? 'Componente kit').trim(),
    cantidad: parseEntero(mapped.cantidad, 1) || 1,
    tipoItem: String(mapped.tipo_item ?? 'ACCESORIO_ESPECIFICO').trim().toUpperCase(),
    tipoComponente: tipoCompRaw && tipoComponenteEnum.safeParse(tipoCompRaw).success ? tipoCompRaw : null,
  })

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Fila kit inválida'
    throw new Error(`${parentSku}: ${msg}`)
  }
  return parsed.data
}

export function generarPlantillaInventarioXlsx(): Buffer {
  const wb = XLSX.utils.book_new()

  const wsData = XLSX.utils.aoa_to_sheet([
    [...ACTION_SALES_HEADERS],
    ACTION_SALES_HEADERS.map((h) => ejemploActionSales[h as keyof typeof ejemploActionSales] ?? ''),
  ])
  wsData['!cols'] = ACTION_SALES_HEADERS.map((h) => ({
    wch: h.length > 20 ? 24 : Math.max(h.length + 4, 14),
  }))
  XLSX.utils.book_append_sheet(wb, wsData, 'Sheet')

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

export function generarPlantillaLegacyInventarioXlsx(): Buffer {
  const wb = XLSX.utils.book_new()
  const headers = [...INVENTARIO_EXCEL_HEADERS]
  const ejemploFila = {
    nombre: 'Monitor multiparamétrico',
    sku: 'MON123',
    descripcion: 'Monitor de signos vitales',
    categoria: 'Equipos',
    tipo_articulo: 'EQUIPO',
    marca: 'Mindray',
    modelo: 'ePM 12',
    es_serializado: false,
    requiere_preventivo: true,
    intervalo_preventivo_dias: 180,
    stock: 0,
    stock_minimo: 0,
    stock_maximo: null,
    punto_pedido: null,
    precio_unit: null,
    alicuota_iva_pct: 21,
  }
  const wsData = XLSX.utils.aoa_to_sheet([
    headers,
    headers.map((h) => {
      const val = ejemploFila[h as keyof typeof ejemploFila]
      return val ?? ''
    }),
  ])
  XLSX.utils.book_append_sheet(wb, wsData, 'productos')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

export function parsearInventarioXlsx(buffer: Buffer): InventarioImportRow[] {
  return parsearInventarioWorkbook(buffer).productos
}

export function parsearInventarioWorkbook(buffer: Buffer): InventarioWorkbookParse {
  const wb = XLSX.read(buffer, { type: 'buffer' })

  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase() === 'sheet') ??
    wb.SheetNames.find((n) => n.toLowerCase() === 'productos') ??
    wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName!]
  if (!sheet) throw new Error('El archivo no contiene datos')

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (rows.length === 0) throw new Error('No se encontraron filas en el Excel')

  const formato = esFormatoActionSales(rows[0] ?? {}) ? 'action_sales' : 'legacy'
  const productos: InventarioImportRow[] = []

  for (const row of rows) {
    const parsed = formato === 'action_sales' ? mapFilaActionSales(row) : mapFilaLegacy(row)
    if (parsed) productos.push(parsed)
  }

  if (productos.length === 0) throw new Error('No se encontraron filas válidas en el Excel')
  if (productos.length > 2500) throw new Error('Máximo 2500 filas por importación')

  const kitSheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'kit')
  const kits: KitImportRow[] = []
  if (kitSheetName && formato === 'legacy') {
    const kitSheet = wb.Sheets[kitSheetName]
    const kitRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(kitSheet, { defval: '' })
    for (const row of kitRows) {
      const parsed = mapKitFilaRaw(row)
      if (parsed) kits.push(parsed)
    }
    if (kits.length > 5000) throw new Error('Máximo 5000 filas de kit por importación')
  }

  return { productos, kits, formato }
}
