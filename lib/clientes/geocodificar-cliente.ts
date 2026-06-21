import { prisma } from '@/lib/prisma'
import { geocodificarDireccion } from '@/lib/geocoding'

export async function geocodificarClientePorId(
  clienteId: string,
  opts?: { force?: boolean },
): Promise<{ lat: number; lng: number; displayName?: string } | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, direccion: true, ciudad: true, lat: true, lng: true },
  })
  if (!cliente) return null
  return geocodificarCliente(cliente, opts)
}

export async function geocodificarCliente(
  cliente: {
    id: string
    direccion?: string | null
    ciudad?: string | null
    lat?: number | null
    lng?: number | null
  },
  opts?: { force?: boolean },
): Promise<{ lat: number; lng: number; displayName?: string } | null> {
  if (!opts?.force && cliente.lat != null && cliente.lng != null) {
    return { lat: cliente.lat, lng: cliente.lng }
  }

  const geo = await geocodificarDireccion(cliente.direccion, cliente.ciudad)
  if (!geo) return null

  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { lat: geo.lat, lng: geo.lng },
  })

  await propagarCoordenadasAEquiposSinUbicacion(
    cliente.id,
    geo.lat,
    geo.lng,
    cliente.direccion ?? cliente.ciudad ?? geo.displayName,
  )

  return { lat: geo.lat, lng: geo.lng, displayName: geo.displayName }
}

export async function propagarCoordenadasAEquiposSinUbicacion(
  clienteId: string,
  lat: number,
  lng: number,
  direccion?: string | null,
) {
  await prisma.equipo.updateMany({
    where: {
      clienteId,
      ubicacionLat: null,
      sucursalId: null,
      direccionUbicacion: null,
    },
    data: {
      ubicacionLat: lat,
      ubicacionLng: lng,
      ...(direccion ? { direccionUbicacion: direccion } : {}),
    },
  })
}

export function direccionClienteLabel(cliente: {
  direccion?: string | null
  ciudad?: string | null
  nombre?: string
}): string {
  return [cliente.direccion, cliente.ciudad].filter(Boolean).join(', ') || cliente.nombre || 'Cliente'
}
