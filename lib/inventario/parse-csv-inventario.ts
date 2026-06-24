/**
 * Parseo CSV de importación masiva de inventario (sin Prisma — testeable).
 * Columnas: sku|codigo, nombre, stock, stockMinimo, precio (opcional).
 */
import { parsearLineaCsv } from '@/lib/clientes/parse-csv-clientes'

export interface InventarioCsvRow {
  sku: string
  nombre: string
  stock: number
  stockMinimo: number
  precio?: number
}

export interface FilaCsvInventario {
  fila: number
  datos?: InventarioCsvRow
  error?: string
}

const COLUMNAS_OBLIGATORIAS = ['nombre', 'stock', 'stockminimo'] as const

function normalizarHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '').replace(/_/g, '')
}

function parsearEntero(val: string, campo: string): number | string {
  const t = val.trim()
  if (!t) return `${campo} obligatorio`
  const n = Number(t.replace(',', '.'))
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return `${campo} debe ser un entero ≥ 0`
  }
  return n
}

function parsearPrecioOpcional(val: string): number | undefined | string {
  const t = val.trim()
  if (!t) return undefined
  const n = Number(t.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return 'precio debe ser un número ≥ 0'
  return n
}

export function generarPlantillaCsvInventario(): string {
  return [
    'sku,nombre,stock,stockMinimo,precio',
    'REP-001,Filtro bacteriano,50,10,1500.50',
    'REP-002,Sensor SpO2 reutilizable,25,5,',
  ].join('\n')
}

export function parsearCsvInventario(contenido: string): FilaCsvInventario[] {
  const texto = contenido.replace(/^\uFEFF/, '').trim()
  if (!texto) return []

  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lineas.length === 0) return []

  const headerRaw = parsearLineaCsv(lineas[0]!)
  const headerMap = new Map<string, number>()
  headerRaw.forEach((h, idx) => {
    headerMap.set(normalizarHeader(h), idx)
  })

  const skuIdx = headerMap.has('sku') ? headerMap.get('sku')! : headerMap.get('codigo')
  if (skuIdx == null) {
    return [{
      fila: 1,
      error: 'Columna obligatoria faltante: sku o codigo',
    }]
  }

  const faltantes = COLUMNAS_OBLIGATORIAS.filter((c) => !headerMap.has(c))
  if (faltantes.length > 0) {
    return [{
      fila: 1,
      error: `Columnas obligatorias faltantes: ${faltantes.join(', ')} (esperado: sku/codigo, nombre, stock, stockMinimo)`,
    }]
  }

  const idxNombre = headerMap.get('nombre')!
  const idxStock = headerMap.get('stock')!
  const idxStockMin = headerMap.get('stockminimo')!
  const idxPrecio = headerMap.get('precio')

  const resultados: FilaCsvInventario[] = []
  const skusEnArchivo = new Set<string>()

  for (let i = 1; i < lineas.length; i++) {
    const fila = i + 1
    const cols = parsearLineaCsv(lineas[i]!)
    const sku = (cols[skuIdx] ?? '').trim()
    const nombre = (cols[idxNombre] ?? '').trim()

    if (!sku && !nombre) continue

    if (!sku) {
      resultados.push({ fila, error: 'sku/codigo obligatorio' })
      continue
    }
    if (!nombre) {
      resultados.push({ fila, error: 'nombre obligatorio' })
      continue
    }

    if (skusEnArchivo.has(sku.toLowerCase())) {
      resultados.push({ fila, error: `SKU duplicado en el archivo: ${sku}` })
      continue
    }
    skusEnArchivo.add(sku.toLowerCase())

    const stock = parsearEntero(cols[idxStock] ?? '', 'stock')
    if (typeof stock === 'string') {
      resultados.push({ fila, error: stock })
      continue
    }

    const stockMinimo = parsearEntero(cols[idxStockMin] ?? '', 'stockMinimo')
    if (typeof stockMinimo === 'string') {
      resultados.push({ fila, error: stockMinimo })
      continue
    }

    let precio: number | undefined
    if (idxPrecio != null) {
      const p = parsearPrecioOpcional(cols[idxPrecio] ?? '')
      if (typeof p === 'string') {
        resultados.push({ fila, error: p })
        continue
      }
      precio = p
    }

    resultados.push({
      fila,
      datos: { sku, nombre, stock, stockMinimo, precio },
    })
  }

  return resultados
}
