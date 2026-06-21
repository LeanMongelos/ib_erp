/**
 * Plantilla e importación masiva de inventario (Excel .xlsx).
 */
import * as XLSX from 'xlsx'
import { z } from 'zod'

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

const ejemploFila = {
  nombre: 'Monitor multiparamétrico Mindray ePM 12',
  sku: 'MON-PAT-001',
  descripcion: 'Monitor de signos vitales 12"',
  categoria: 'Equipos',
  tipo_articulo: 'EQUIPO',
  marca: 'Mindray',
  modelo: 'ePM 12',
  es_serializado: true,
  requiere_preventivo: true,
  intervalo_preventivo_dias: 180,
  stock: 2,
  stock_minimo: 1,
  stock_maximo: 10,
  punto_pedido: 2,
  precio_unit: 850000,
  alicuota_iva_pct: 21,
}

const ejemploKit = {
  parent_sku: 'MON-PAT-001',
  child_sku: 'CAB-SPO2-001',
  nombre: 'Cable SpO2 incluido',
  cantidad: 1,
  tipo_item: 'ACCESORIO_ESPECIFICO',
  tipo_componente: '',
}

const tipoArticuloEnum = z.enum(['REPUESTO', 'CONSUMIBLE', 'ACCESORIO', 'BATERIA', 'EQUIPO'])
const tipoItemKitEnum = z.enum(['ACCESORIO_ESPECIFICO', 'ACCESORIO_GENERICO', 'BATERIA', 'COMPONENTE', 'REPUESTO_INCLUIDO'])
const tipoComponenteEnum = z.enum(['BATERIA', 'FILTRO', 'CALIBRACION', 'SENSOR', 'OTRO'])

export const inventarioImportRowSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre obligatorio (mín. 2 caracteres)'),
  sku: z.string().trim().max(40).optional().nullable(),
  descripcion: z.string().trim().max(300).optional().nullable(),
  categoria: z.string().trim().max(60).optional().nullable(),
  tipoArticulo: tipoArticuloEnum.default('REPUESTO'),
  marca: z.string().trim().max(80).optional().nullable(),
  modelo: z.string().trim().max(80).optional().nullable(),
  esSerializado: z.boolean().default(false),
  requierePreventivo: z.boolean().default(false),
  intervaloPreventivoDias: z.number().int().positive().optional().nullable(),
  stock: z.number().int().nonnegative().default(0),
  stockMinimo: z.number().int().nonnegative().default(5),
  stockMaximo: z.number().int().positive().optional().nullable(),
  puntoPedido: z.number().int().nonnegative().optional().nullable(),
  precioUnit: z.number().nonnegative().optional().nullable(),
  alicuotaIvaPct: z.number().min(0).max(100).optional().nullable(),
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
}

function normalizarClave(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
  const nombre = String(row.nombre ?? row.parent_sku ?? '').trim().toLowerCase()
  return nombre === 'nombre' || nombre === 'parent_sku' || nombre === 'ejemplo' || nombre.startsWith('*')
}

function mapFilaRaw(raw: Record<string, unknown>): InventarioImportRow | null {
  const mapped: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    mapped[normalizarClave(k)] = v
  }

  const nombre = String(mapped.nombre ?? '').trim()
  if (!nombre || filaEsEncabezado(mapped as Record<string, unknown>)) return null

  const tipoRaw = String(mapped.tipo_articulo ?? 'REPUESTO').trim().toUpperCase()

  const parsed = inventarioImportRowSchema.safeParse({
    nombre,
    sku: mapped.sku ? String(mapped.sku).trim() : null,
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

  const instrucciones = [
    ['Plantilla de inventario — iBiomédica ERP'],
    ['Completá la hoja "productos". No modifiques los nombres de columna de la fila 1.'],
    ['tipo_articulo: REPUESTO | CONSUMIBLE | ACCESORIO | BATERIA | EQUIPO'],
    ['es_serializado / requiere_preventivo: si/no, 1/0. intervalo_preventivo_dias: solo EQUIPO'],
    ['Hoja "kit" (opcional): parent_sku, child_sku, cantidad, tipo_item, tipo_componente'],
    [],
  ]

  const wsInfo = XLSX.utils.aoa_to_sheet(instrucciones)
  XLSX.utils.book_append_sheet(wb, wsInfo, 'instrucciones')

  const headers = [...INVENTARIO_EXCEL_HEADERS]
  const wsData = XLSX.utils.aoa_to_sheet([
    headers,
    headers.map((h) => {
      const val = ejemploFila[h as keyof typeof ejemploFila]
      return val ?? ''
    }),
  ])
  wsData['!cols'] = headers.map(() => ({ wch: 18 }))
  XLSX.utils.book_append_sheet(wb, wsData, 'productos')

  const kitHeaders = [...KIT_EXCEL_HEADERS]
  const wsKit = XLSX.utils.aoa_to_sheet([
    kitHeaders,
    kitHeaders.map((h) => ejemploKit[h as keyof typeof ejemploKit] ?? ''),
  ])
  XLSX.utils.book_append_sheet(wb, wsKit, 'kit')

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

export function parsearInventarioXlsx(buffer: Buffer): InventarioImportRow[] {
  return parsearInventarioWorkbook(buffer).productos
}

export function parsearInventarioWorkbook(buffer: Buffer): InventarioWorkbookParse {
  const wb = XLSX.read(buffer, { type: 'buffer' })

  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'productos') ?? wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  if (!sheet) throw new Error('El archivo no contiene datos')

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const productos: InventarioImportRow[] = []
  for (const row of rows) {
    const parsed = mapFilaRaw(row)
    if (parsed) productos.push(parsed)
  }
  if (productos.length === 0) throw new Error('No se encontraron filas válidas en el Excel')
  if (productos.length > 2000) throw new Error('Máximo 2000 filas por importación')

  const kitSheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'kit')
  const kits: KitImportRow[] = []
  if (kitSheetName) {
    const kitSheet = wb.Sheets[kitSheetName]
    const kitRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(kitSheet, { defval: '' })
    for (const row of kitRows) {
      const parsed = mapKitFilaRaw(row)
      if (parsed) kits.push(parsed)
    }
    if (kits.length > 5000) throw new Error('Máximo 5000 filas de kit por importación')
  }

  return { productos, kits }
}
