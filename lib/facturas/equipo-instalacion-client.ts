/**
 * Reglas compartidas UI ↔ API: ítems de tipo EQUIPO exigen sucursal de instalación.
 * Client-safe (sin Prisma).
 */

export type ItemEquipoInstalacion = {
  descripcion?: string
  tipoArticulo?: string | null
  inventarioId?: string | null
  sucursalInstalacionId?: string | null
}

export function esItemEquipoInstalacion(
  item: Pick<ItemEquipoInstalacion, 'tipoArticulo'>,
): boolean {
  return item.tipoArticulo === 'EQUIPO'
}

export function mensajeSucursalInstalacionFaltante(descripcion?: string): string {
  const label = descripcion?.trim() || 'Equipo'
  return `«${label}»: seleccioná la sucursal de instalación`
}

/** Validación pura (misma regla que la UI). */
export function validarSucursalesInstalacionEquipoCliente(
  items: ItemEquipoInstalacion[],
): string | null {
  for (const item of items) {
    if (!esItemEquipoInstalacion(item)) continue
    if (!item.sucursalInstalacionId) {
      return mensajeSucursalInstalacionFaltante(item.descripcion)
    }
  }
  return null
}
