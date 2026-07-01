export type ItemPresupuestoPayload = {
  descripcion: string
  cantidad: number
  precioUnit: number
  alicuotaIvaPct?: number
  inventarioId?: string | null
  codigo?: string
  fotoUrl?: string
  tipoArticulo?: string | null
  numeroSerie?: string
  proximoPreventivo?: string
}

export function itemsPresupuestoParaApi<T extends { descripcion: string }>(
  items: T[],
  map: (item: T) => ItemPresupuestoPayload,
): ItemPresupuestoPayload[] {
  return items.filter((i) => i.descripcion.trim()).map(map)
}
