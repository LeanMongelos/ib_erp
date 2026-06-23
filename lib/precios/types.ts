import type { TipoListaPrecios } from '@prisma/client'

export type OrigenPrecio = 'LISTA' | 'INVENTARIO' | 'SIN_PRECIO'

export interface PrecioResuelto {
  precioUnit: number
  moneda: string
  origen: OrigenPrecio
  listaPreciosId?: string
  listaPreciosCodigo?: string
  listaPreciosNombre?: string
  listaPreciosTipo?: TipoListaPrecios
  bonificacionPct?: number
  ajusteGlobalPct?: number
}

/** Etiqueta legible para el ajuste global de una lista (descuento o recargo). */
export function etiquetaAjusteGlobal(pct: number): string {
  if (pct === 0) return 'Sin ajuste global'
  if (pct < 0) return `Descuento global ${Math.abs(pct)}%`
  return `Recargo global ${pct}%`
}

/** Formato corto con signo: -10%, +5%, 0% */
export function formatearAjusteGlobal(pct: number): string {
  if (pct === 0) return '0%'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}%`
}

export const ETIQUETA_ORIGEN_PRECIO: Record<OrigenPrecio, string> = {
  LISTA: 'Lista de precios',
  INVENTARIO: 'Precio base inventario',
  SIN_PRECIO: 'Sin precio',
}

export const ETIQUETA_TIPO_LISTA: Record<TipoListaPrecios, string> = {
  MINORISTA: 'Lista minorista',
  MAYORISTA: 'Lista mayorista',
  INSTITUCIONAL: 'Lista institucional',
  PROMOCION: 'Lista promoción',
  ESPECIAL: 'Lista especial',
}

export function etiquetaOrigenPrecio(resuelto: Pick<PrecioResuelto, 'origen' | 'listaPreciosTipo' | 'listaPreciosNombre'>): string {
  if (resuelto.origen === 'LISTA') {
    if (resuelto.listaPreciosTipo) return ETIQUETA_TIPO_LISTA[resuelto.listaPreciosTipo]
    if (resuelto.listaPreciosNombre) return resuelto.listaPreciosNombre
    return ETIQUETA_ORIGEN_PRECIO.LISTA
  }
  return ETIQUETA_ORIGEN_PRECIO[resuelto.origen]
}
