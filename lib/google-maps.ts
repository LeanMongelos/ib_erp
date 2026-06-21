/**
 * Enlaces a Google Maps (sin API key).
 * Abre la app web o nativa para navegar hasta un punto o recorrer una ruta.
 */

export function googleMapsVerUbicacion(opts: { lat: number; lng: number; label?: string }) {
  const q = opts.label
    ? encodeURIComponent(`${opts.lat},${opts.lng} (${opts.label})`)
    : `${opts.lat},${opts.lng}`
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

/** Navegación / cómo llegar desde la ubicación actual del dispositivo. */
export function googleMapsNavegar(opts: { lat: number; lng: number; label?: string }) {
  const dest = opts.label
    ? encodeURIComponent(`${opts.lat},${opts.lng} (${opts.label})`)
    : `${opts.lat},${opts.lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
}

/** Recorrido con origen, waypoints opcionales y destino final. */
export function googleMapsRecorrido(puntos: { lat: number; lng: number }[]) {
  if (puntos.length === 0) return googleMapsVerUbicacion({ lat: -26.1849, lng: -58.1731 })
  if (puntos.length === 1) return googleMapsNavegar(puntos[0])

  const origin = `${puntos[0].lat},${puntos[0].lng}`
  const destination = `${puntos[puntos.length - 1].lat},${puntos[puntos.length - 1].lng}`
  const waypoints =
    puntos.length > 2
      ? puntos
          .slice(1, -1)
          .map((p) => `${p.lat},${p.lng}`)
          .join('|')
      : ''

  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
  })
  if (waypoints) params.set('waypoints', waypoints)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function abrirGoogleMaps(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
