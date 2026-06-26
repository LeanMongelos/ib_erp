/**
 * Parseo CSV de importación masiva de clientes (sin Prisma — testeable).
 */
import { formatearCuit, validarCuit } from '@/lib/cuit'

export interface ClienteImportRow {
  razonSocial: string
  cuit: string
  email?: string
  telefono?: string
}

export interface FilaCsvCliente {
  fila: number
  datos?: ClienteImportRow
  error?: string
}

const COLUMNAS = ['razonsocial', 'cuit', 'email', 'telefono'] as const

function normalizarHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '').replace(/_/g, '')
}

/** Parsea una línea CSV respetando comillas dobles. */
export function parsearLineaCsv(linea: string): string[] {
  const campos: string[] = []
  let actual = ''
  let enComillas = false

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]!
    if (c === '"') {
      if (enComillas && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else {
        enComillas = !enComillas
      }
    } else if ((c === ',' || c === ';') && !enComillas) {
      campos.push(actual.trim())
      actual = ''
    } else {
      actual += c
    }
  }
  campos.push(actual.trim())
  return campos
}

function validarEmail(email: string): boolean {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function parsearCsvClientes(contenido: string): FilaCsvCliente[] {
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
      error: `Columnas obligatorias faltantes: ${faltantes.join(', ')} (esperado: razonSocial, cuit, email, telefono)`,
    }]
  }

  const resultados: FilaCsvCliente[] = []

  for (let i = 1; i < lineas.length; i++) {
    const fila = i + 1
    const cols = parsearLineaCsv(lineas[i]!)
    const get = (col: typeof COLUMNAS[number]) => (cols[headerMap.get(col)!] ?? '').trim()

    const razonSocial = get('razonsocial')
    const cuitRaw = get('cuit')
    const email = get('email')
    const telefono = get('telefono')

    if (!razonSocial && !cuitRaw && !email && !telefono) continue

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
        telefono: telefono || undefined,
      },
    })
  }

  return resultados
}

export function generarPlantillaCsvClientes(): string {
  return [
    'razonSocial,cuit,email,telefono',
    'Clínica Ejemplo SA,33-70999888-9,contacto@ejemplo.com.ar,3704123456',
    'Hospital Regional,20-24440827-4,,',
  ].join('\n')
}
