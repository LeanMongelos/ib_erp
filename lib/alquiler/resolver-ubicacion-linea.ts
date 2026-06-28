import { geocodificarLineaAlquiler } from '@/lib/geocoding'
import { UBICACION_IB } from '@/lib/tracking'

export type LineaUbicacionInput = {
  id: string
  domicilio?: string | null
  localidad?: string | null
  provincia?: string | null
  lat?: number | null
  lng?: number | null
  beneficiarioNombre?: string | null
  inventarioUnidad?: { numeroSerie?: string | null }
}

export type ClienteUbicacionFallback = {
  lat?: number | null
  lng?: number | null
  sucursales?: Array<{ lat: number | null; lng: number | null; nombre?: string }>
}

export type UbicacionResuelta = {
  lat: number
  lng: number
  fuente:
    | 'linea_guardada'
    | 'geocodificacion_domicilio'
    | 'geocodificacion_localidad'
    | 'sucursal_cliente'
    | 'cliente'
    | 'deposito_ib'
}

function etiquetaLinea(linea: LineaUbicacionInput): string {
  const serie = linea.inventarioUnidad?.numeroSerie
  return serie ? `línea S/N ${serie}` : `línea ${linea.id.slice(-6)}`
}

export async function resolverUbicacionLineaAlquiler(
  linea: LineaUbicacionInput,
  cliente?: ClienteUbicacionFallback | null,
): Promise<UbicacionResuelta> {
  if (linea.lat != null && linea.lng != null) {
    return { lat: linea.lat, lng: linea.lng, fuente: 'linea_guardada' }
  }

  const geo = await geocodificarLineaAlquiler(linea.domicilio, linea.localidad, linea.provincia)
  if (geo?.nivel === 'domicilio') {
    return { lat: geo.lat, lng: geo.lng, fuente: 'geocodificacion_domicilio' }
  }
  if (geo?.nivel === 'localidad') {
    return { lat: geo.lat, lng: geo.lng, fuente: 'geocodificacion_localidad' }
  }

  const sucursal = cliente?.sucursales?.find((s) => s.lat != null && s.lng != null)
  if (sucursal?.lat != null && sucursal.lng != null) {
    return { lat: sucursal.lat, lng: sucursal.lng, fuente: 'sucursal_cliente' }
  }

  if (cliente?.lat != null && cliente.lng != null) {
    return { lat: cliente.lat, lng: cliente.lng, fuente: 'cliente' }
  }

  return { lat: UBICACION_IB.lat, lng: UBICACION_IB.lng, fuente: 'deposito_ib' }
}

/** Exige coordenadas confirmadas en la línea o geocodificación de domicilio/localidad. */
export async function resolverUbicacionLineaAlquilerEstricta(
  linea: LineaUbicacionInput,
  cliente?: ClienteUbicacionFallback | null,
): Promise<UbicacionResuelta> {
  if (linea.lat != null && linea.lng != null) {
    return { lat: linea.lat, lng: linea.lng, fuente: 'linea_guardada' }
  }

  const geo = await geocodificarLineaAlquiler(linea.domicilio, linea.localidad, linea.provincia)
  if (geo) {
    return {
      lat: geo.lat,
      lng: geo.lng,
      fuente: geo.nivel === 'domicilio' ? 'geocodificacion_domicilio' : 'geocodificacion_localidad',
    }
  }

  throw new Error(
    `${etiquetaLinea(linea)}: no se pudo ubicar en el mapa. Completá domicilio y localidad, confirmá el pin en el mapa, o arrastrá el marcador manualmente.`,
  )
}
