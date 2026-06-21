import type { TextOverflow } from './types'

export interface OpcionesTexto {
  maxChars?: number
  overflow?: TextOverflow
}

/** Aplica límite de caracteres según modo de overflow. */
export function limitarTexto(texto: string, opts?: OpcionesTexto): string {
  const t = (texto ?? '').trim()
  if (!t) return ''
  const max = opts?.maxChars
  if (!max || max <= 0 || t.length <= max) return t

  const modo = opts?.overflow ?? 'ellipsis'
  if (modo === 'wrap') return t.slice(0, max)
  if (modo === 'truncate') return t.slice(0, max)
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

/** Divide texto en líneas respetando maxLineas (wrap manual para preview HTML). */
export function lineasTexto(texto: string, maxLineas?: number): string[] {
  const lineas = texto.split(/\n+/).flatMap((p) => {
    if (!p) return ['']
    return p.match(/.{1,80}(\s|$)|.{1,80}/g) ?? [p]
  })
  if (!maxLineas || maxLineas <= 0) return lineas
  if (lineas.length <= maxLineas) return lineas
  const recortadas = lineas.slice(0, maxLineas)
  recortadas[maxLineas - 1] = `${recortadas[maxLineas - 1].replace(/…?$/, '')}…`
  return recortadas
}

export function textoColumnaItem(
  key: string,
  item: { codigo?: string | null; descripcion: string; descripcionLarga?: string | null },
  col?: OpcionesTexto & { key?: string },
): string {
  if (key === 'codigo') return limitarTexto(item.codigo ?? '—', col)
  if (key === 'descripcion') {
    const base = item.descripcion ?? ''
    const larga = item.descripcionLarga?.trim()
    const unido = larga ? `${base}\n${larga}` : base
    return limitarTexto(unido, col)
  }
  return ''
}
