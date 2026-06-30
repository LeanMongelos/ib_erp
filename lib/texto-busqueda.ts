/**
 * Búsqueda flexible: ignora acentos, mayúsculas, separa por palabras y tolera typos leves.
 */

/** Quita tildes y diacríticos (Aerocámara → Aerocamara). */
export function quitarAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizarTextoBusqueda(s: string): string {
  return quitarAcentos(s).toLowerCase().trim()
}

/** Palabras/claves de búsqueda (mín. 2 caracteres). */
export function tokenizarBusqueda(q: string, minLen = 2): string[] {
  const norm = normalizarTextoBusqueda(q)
  if (!norm) return []
  return norm.split(/[\s,;/+]+/).filter((t) => t.length >= minLen)
}

/** Distancia de edición de Levenshtein entre dos cadenas ya normalizadas. */
export function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]!
}

/** Umbral de typos permitidos según longitud del token (conservador). */
export function umbralLevenshtein(longitud: number): number {
  if (longitud <= 2) return 0
  if (longitud <= 7) return 1
  return 2
}

function extraerPalabras(blob: string): string[] {
  return blob.split(/[\s,;/+._-]+/).filter((w) => w.length >= 2)
}

/**
 * ¿El token coincide en el blob (substring exacto o fuzzy palabra a palabra)?
 */
export function tokensCoincidenFuzzy(blob: string, token: string): boolean {
  if (token.length < 2) return false
  if (blob.includes(token)) return true

  const maxDist = umbralLevenshtein(token.length)
  if (maxDist === 0) return false

  for (const palabra of extraerPalabras(blob)) {
    if (Math.abs(palabra.length - token.length) > maxDist) continue
    if (distanciaLevenshtein(token, palabra) <= maxDist) return true
  }
  return false
}

/** ¿El texto del producto contiene todas las palabras buscadas? (client-side). */
export function textoContieneBusqueda(
  textos: (string | null | undefined)[],
  query: string,
): boolean {
  const tokens = tokenizarBusqueda(query, 2)
  if (tokens.length === 0) {
    const q = normalizarTextoBusqueda(query)
    if (q.length < 2) return false
    const blob = normalizarTextoBusqueda(textos.filter(Boolean).join(' '))
    return blob.includes(q) || tokensCoincidenFuzzy(blob, q)
  }
  const blob = normalizarTextoBusqueda(textos.filter(Boolean).join(' '))
  return tokens.every((t) => tokensCoincidenFuzzy(blob, t))
}
