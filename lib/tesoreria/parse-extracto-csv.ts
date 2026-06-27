export interface LineaExtracto {
  indice: number
  fecha: Date
  descripcion: string
  montoSigned: number
  referencia?: string
}

const ALIAS_FECHA = ['fecha', 'date', 'fch', 'fec', 'fecha movimiento', 'fecha_movimiento']
const ALIAS_DESC = ['descripcion', 'descripción', 'concepto', 'detalle', 'movimiento', 'glosa']
const ALIAS_DEBITO = ['debito', 'débito', 'debe', 'egreso', 'salida']
const ALIAS_CREDITO = ['credito', 'crédito', 'haber', 'ingreso', 'entrada']
const ALIAS_MONTO = ['monto', 'importe', 'amount', 'valor']
const ALIAS_REF = ['referencia', 'ref', 'nro', 'numero', 'número', 'comprobante']

function normHeader(h: string): string {
  return h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function parseFechaAr(val: string): Date | null {
  const s = val.trim()
  if (!s) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`)
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.exec(s)
  if (dmy) {
    let y = Number(dmy[3])
    if (y < 100) y += 2000
    const d = Number(dmy[1])
    const m = Number(dmy[2])
    return new Date(y, m - 1, d, 12, 0, 0)
  }
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t)
}

function parseNumero(val: string): number | null {
  const s = val.trim().replace(/\s/g, '')
  if (!s) return null
  const neg = s.startsWith('-') || s.startsWith('(')
  const clean = s.replace(/[()$]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(clean)
  if (Number.isNaN(n)) return null
  return neg && n > 0 ? -n : n
}

function detectarSeparador(headerLine: string): string {
  const semi = (headerLine.match(/;/g) ?? []).length
  const comma = (headerLine.match(/,/g) ?? []).length
  return semi >= comma ? ';' : ','
}

function idxCol(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i])
    if (aliases.some((a) => h === a || h.includes(a))) return i
  }
  return -1
}

export function parseExtractoCsv(texto: string): LineaExtracto[] {
  const lines = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const sep = detectarSeparador(lines[0])
  const headers = lines[0].split(sep).map((h) => h.replace(/^"|"$/g, ''))
  const iFecha = idxCol(headers, ALIAS_FECHA)
  const iDesc = idxCol(headers, ALIAS_DESC)
  const iDeb = idxCol(headers, ALIAS_DEBITO)
  const iCred = idxCol(headers, ALIAS_CREDITO)
  const iMonto = idxCol(headers, ALIAS_MONTO)
  const iRef = idxCol(headers, ALIAS_REF)

  if (iFecha < 0) throw new Error('No se encontró columna de fecha en el CSV')

  const out: LineaExtracto[] = []
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(sep).map((c) => c.replace(/^"|"$/g, '').trim())
    const fecha = parseFechaAr(cols[iFecha] ?? '')
    if (!fecha) continue

    let montoSigned: number | null = null
    if (iDeb >= 0 || iCred >= 0) {
      const deb = iDeb >= 0 ? parseNumero(cols[iDeb] ?? '') : null
      const cred = iCred >= 0 ? parseNumero(cols[iCred] ?? '') : null
      if (deb && deb !== 0) montoSigned = -Math.abs(deb)
      else if (cred && cred !== 0) montoSigned = Math.abs(cred)
    }
    if (montoSigned == null && iMonto >= 0) {
      montoSigned = parseNumero(cols[iMonto] ?? '')
    }
    if (montoSigned == null || montoSigned === 0) continue

    out.push({
      indice: r,
      fecha,
      descripcion: (iDesc >= 0 ? cols[iDesc] : cols.find(Boolean)) ?? `Línea ${r}`,
      montoSigned,
      referencia: iRef >= 0 ? cols[iRef] || undefined : undefined,
    })
  }
  return out
}
