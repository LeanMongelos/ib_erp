/** Helpers de tipo de artículo en catálogo (venta vs alquiler vs insumos). */

export const TIPOS_ARTICULO_INVENTARIO = [
  'REPUESTO',
  'CONSUMIBLE',
  'ACCESORIO',
  'BATERIA',
  'EQUIPO',
  'ALQUILER',
] as const

export type TipoArticuloInventarioCodigo = (typeof TIPOS_ARTICULO_INVENTARIO)[number]

export function isEquipoVenta(tipo: string | null | undefined): boolean {
  return tipo === 'EQUIPO'
}

export function isEquipoAlquiler(tipo: string | null | undefined): boolean {
  return tipo === 'ALQUILER'
}

/** Equipo serializado en catálogo (venta o parque de alquiler): kit, SN, preventivo. */
export function isEquipoCatalogo(tipo: string | null | undefined): boolean {
  return tipo === 'EQUIPO' || tipo === 'ALQUILER'
}

export function isCodigoParqueAlquiler(sku: string | null | undefined): boolean {
  return (sku ?? '').trim().toUpperCase().startsWith('ALQ')
}

export function inferirTipoArticuloDesdeCodigo(sku: string): TipoArticuloInventarioCodigo | null {
  if (isCodigoParqueAlquiler(sku)) return 'ALQUILER'
  return null
}
