/**
 * Validación de series para emitir remito — sin dependencias server-only (usable en client).
 */

function trazabilidadActiva(modo: string | null | undefined): boolean {
  return Boolean(modo && modo !== 'NINGUNA')
}

function requiereAsignacionSerie(modoTrazabilidad: string | null | undefined, esSerializado: boolean): boolean {
  if (trazabilidadActiva(modoTrazabilidad)) return true
  return esSerializado
}

export type ItemRemitoEmisionCheck = {
  descripcion: string
  inventarioId: string | null
  inventarioUnidadId?: string | null
  equipoId?: string | null
  numeroSerie?: string | null
  inventario?: {
    modoTrazabilidad?: string | null
    tipoArticulo?: string | null
    esSerializado?: boolean
  } | null
}

export function itemRemitoPendienteSerie(item: ItemRemitoEmisionCheck): boolean {
  const inv = item.inventario
  const necesitaSerie = inv
    ? requiereAsignacionSerie(inv.modoTrazabilidad, inv.esSerializado ?? false) || inv.tipoArticulo === 'EQUIPO'
    : Boolean(item.inventarioId)
  if (!necesitaSerie) return false
  return !item.inventarioUnidadId && !item.equipoId && !item.numeroSerie?.trim()
}

export function remitoPendientesEmision(items: ItemRemitoEmisionCheck[]): string[] {
  return items.filter(itemRemitoPendienteSerie).map((i) => i.descripcion)
}

export function remitoListoParaEmitir(items: ItemRemitoEmisionCheck[]): boolean {
  return remitoPendientesEmision(items).length === 0
}
