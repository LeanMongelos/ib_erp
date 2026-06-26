/**
 * Parseo CSV de importación masiva de proveedores (sin Prisma — testeable).
 */
import { formatearCuit, validarCuit } from '@/lib/cuit'
import { parsearLineaCsv } from '@/lib/clientes/parse-csv-clientes'

export interface ProveedorImportRow {
  razonSocial: string
  cuit: string
  email?: string
}

export interface FilaCsvProveedor {
  fila: number
  datos?: ProveedorImportRow
  error?: string
}

const COLUMNAS = ['razonsocial', 'cuit', 'email'] as const

function normalizarHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '').replace(/_/g, '')
}

function validarEmail(email: string): boolean {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function parsearCsvProveedores(contenido: string): FilaCsvProveedor[] {
  const texto = contenido.replace(/^\uFEFF/, '').trim()
  if (!texto) return []

  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lineas.length === 0) return []

  const headerRaw = parsearLineaCsv(lineas[0]!)
  const headerMap = new Map<string, number>()
  headerRaw.forEach((h, idx) => {
    headerMap.set(normalizarHeader(h), idx)
  })

  const faltantes = COLUMNAS.filter((c) => !headerMap.has(c))
  if (faltantes.length > 0) {
    return [{
      fila: 1,
      error: `Columnas obligatorias faltantes: ${faltantes.join(', ')} (esperado: razonSocial, cuit, email)`,
    }]
  }

  const resultados: FilaCsvProveedor[] = []

  for (let i = 1; i < lineas.length; i++) {
    const fila = i + 1
    const cols = parsearLineaCsv(lineas[i]!)
    const get = (col: typeof COLUMNAS[number]) => (cols[headerMap.get(col)!] ?? '').trim()

    const razonSocial = get('razonsocial')
    const cuitRaw = get('cuit')
    const email = get('email')

    if (!razonSocial && !cuitRaw && !email) continue

    if (razonSocial.length < 2) {
      resultados.push({ fila, error: 'razonSocial debe tener al menos 2 caracteres' })
      continue
    }
    if (!cuitRaw) {
      resultados.push({ fila, error: 'cuit es obligatorio' })
      continue
    }
    if (!validarCuit(cuitRaw)) {
      resultados.push({ fila, error: `CUIT inválido: ${cuitRaw}` })
      continue
    }
    if (!validarEmail(email)) {
      resultados.push({ fila, error: `Email inválido: ${email}` })
      continue
    }

    resultados.push({
      fila,
      datos: {
        razonSocial,
        cuit: formatearCuit(cuitRaw),
        email: email || undefined,
      },
    })
  }

  return resultados
}

export function generarPlantillaCsvProveedores(): string {
  return [
    'razonSocial,cuit,email',
    'Distribuidora Médica SA,33-70999888-9,ventas@distmed.com.ar',
    'Importadora Equipos,20-24440827-4,',
  ].join('\n')
}
