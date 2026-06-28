/**
 * Geocodificación server-side (Nominatim / OpenStreetMap).
 */

export interface GeocodingResult {
  lat: number
  lng: number
  displayName: string
}

const USER_AGENT = 'IBiomedica-ERP/1.0 (contacto@ibiomedica.com)'

export function construirDireccionCompleta(
  direccion?: string | null,
  numero?: string | null,
): string | null {
  const calle = direccion?.trim()
  const num = numero?.trim()
  if (!calle) return null
  return num ? `${calle} ${num}` : calle
}

export function construirConsultaGeocoding(
  direccion?: string | null,
  ciudad?: string | null,
  pais = 'Argentina',
): string | null {
  const parts = [direccion?.trim(), ciudad?.trim(), pais].filter(Boolean)
  if (parts.length === 0) return null
  if (!direccion?.trim() && !ciudad?.trim()) return null
  return parts.join(', ')
}

export function construirConsultaSucursal(
  direccion?: string | null,
  numero?: string | null,
  ciudad?: string | null,
  pais = 'Argentina',
): string | null {
  const calleNum = construirDireccionCompleta(direccion, numero)
  return construirConsultaGeocoding(calleNum, ciudad, pais)
}

export async function geocodificarSucursal(
  direccion?: string | null,
  numero?: string | null,
  ciudad?: string | null,
  pais = 'Argentina',
): Promise<GeocodingResult | null> {
  const consulta = construirConsultaSucursal(direccion, numero, ciudad, pais)
  if (!consulta) return null
  return geocodificarConsulta(consulta)
}

export async function geocodificarDireccion(
  direccion?: string | null,
  ciudad?: string | null,
  pais = 'Argentina',
): Promise<GeocodingResult | null> {
  const consulta = construirConsultaGeocoding(direccion, ciudad, pais)
  if (!consulta) return null
  return geocodificarConsulta(consulta)
}

export type GeocodingLineaAlquiler = GeocodingResult & { nivel: 'domicilio' | 'localidad' }

/** Intentos en cascada: domicilio completo → solo localidad/provincia. */
export async function geocodificarLineaAlquiler(
  domicilio?: string | null,
  localidad?: string | null,
  provincia?: string | null,
  pais = 'Argentina',
): Promise<GeocodingLineaAlquiler | null> {
  const calle = domicilio?.trim()
  const loc = localidad?.trim()
  const prov = provincia?.trim()

  const intentos: Array<{ consulta: string | null; nivel: 'domicilio' | 'localidad' }> = [
    {
      consulta: [calle, loc, prov, pais].filter(Boolean).join(', ') || null,
      nivel: 'domicilio',
    },
    {
      consulta: [calle, loc, pais].filter(Boolean).join(', ') || null,
      nivel: 'domicilio',
    },
    {
      consulta: [loc, prov, pais].filter(Boolean).join(', ') || null,
      nivel: 'localidad',
    },
    {
      consulta: loc ? [loc, pais].join(', ') : null,
      nivel: 'localidad',
    },
  ]

  const vistos = new Set<string>()
  for (const { consulta, nivel } of intentos) {
    if (!consulta || vistos.has(consulta)) continue
    vistos.add(consulta)
    const hit = await geocodificarConsulta(consulta)
    if (hit) return { ...hit, nivel }
  }

  return null
}

async function geocodificarConsulta(consulta: string): Promise<GeocodingResult | null> {
  try {
    const q = encodeURIComponent(consulta)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ar`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'es',
        },
        cache: 'no-store',
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
    const hit = data[0]
    if (!hit) return null
    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      displayName: hit.display_name,
    }
  } catch {
    return null
  }
}
