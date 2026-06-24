/**
 * Validación compartida UI ↔ API para sucursales de instalación.
 * Client-safe (sin Prisma).
 */

export type GeoStatusUi = 'idle' | 'loading' | 'confirmed' | 'error'

export type SucursalParaValidar = {
  nombre: string
  direccion?: string | null
  numero?: string | null
  ciudad?: string | null
  lat?: number | null
  lng?: number | null
  /** Presente solo en formularios con mapa (UI). */
  geoStatus?: GeoStatusUi
}

export function validarSucursalEnIndice(s: SucursalParaValidar, index: number): string | null {
  const prefix = `Sucursal ${index + 1}`

  if (s.nombre.trim().length < 2) {
    return `${prefix}: el nombre es obligatorio`
  }
  if (!s.direccion?.trim()) {
    return `${prefix}: indicá la calle o dirección`
  }
  if (!s.numero?.trim()) {
    return `${prefix}: indicá el número de calle`
  }
  if (!s.ciudad?.trim()) {
    return `${prefix}: indicá la ciudad`
  }

  if (s.geoStatus === 'loading') {
    return `${prefix}: esperá a que termine la validación en el mapa`
  }

  if (s.geoStatus !== undefined) {
    if (s.lat == null || s.lng == null || s.geoStatus !== 'confirmed') {
      return `${prefix}: validá la ubicación en el mapa (calle + número + ciudad)`
    }
    return null
  }

  if (s.lat == null || s.lng == null) {
    return `${prefix}: la ubicación debe estar geocodificada (lat/lng)`
  }

  return null
}

export function validarListaSucursales(
  sucursales: SucursalParaValidar[],
  opts?: { exigirAlMenosUna?: boolean },
): string | null {
  if (opts?.exigirAlMenosUna && sucursales.length === 0) {
    return 'Agregá al menos una sucursal de instalación'
  }
  if (sucursales.length === 0) return null

  for (let i = 0; i < sucursales.length; i++) {
    const err = validarSucursalEnIndice(sucursales[i], i)
    if (err) return err
  }
  return null
}
