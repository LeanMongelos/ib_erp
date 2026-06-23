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
  descuentoGlobalPct?: number
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
