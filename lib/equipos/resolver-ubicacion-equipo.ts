import { prisma } from '@/lib/prisma'
import { geocodificarSucursal, construirDireccionCompleta } from '@/lib/geocoding'
import { direccionClienteLabel } from '@/lib/clientes/geocodificar-cliente'

export interface UbicacionResuelta {
  lat: number
  lng: number
  direccion: string
  fuente: 'equipo_coords' | 'equipo_direccion' | 'sucursal' | 'cliente'
}

export function etiquetaUbicacionEquipo(equipo: {
  direccionUbicacion?: string | null
  pisoSala?: string | null
  servicioInstalacion?: string | null
  sucursal?: { nombre: string; direccion?: string | null; numero?: string | null; ciudad?: string | null } | null
  cliente?: { nombre?: string; direccion?: string | null; ciudad?: string | null } | null
}): string {
  const partes = [
    equipo.servicioInstalacion,
    equipo.pisoSala,
    equipo.direccionUbicacion,
  ].filter(Boolean)

  if (partes.length) return partes.join(' · ')

  if (equipo.sucursal) {
    const dir = [
      equipo.sucursal.direccion,
      equipo.sucursal.numero,
    ].filter(Boolean).join(' ')
    return [equipo.sucursal.nombre, dir || null, equipo.sucursal.ciudad].filter(Boolean).join(' · ')
  }

  if (equipo.cliente) return direccionClienteLabel(equipo.cliente)
  return 'Ubicación no definida'
}

async function geocodificarTexto(direccion?: string | null, ciudad?: string | null, numero?: string | null) {
  if (!direccion?.trim() && !ciudad?.trim()) return null
  return geocodificarSucursal(direccion, numero, ciudad)
}

export async function geocodificarSucursalPorId(
  sucursalId: string,
  opts?: { force?: boolean },
): Promise<UbicacionResuelta | null> {
  const suc = await prisma.clienteSucursal.findUnique({
    where: { id: sucursalId },
    select: { id: true, nombre: true, direccion: true, numero: true, ciudad: true, lat: true, lng: true },
  })
  if (!suc) return null

  if (!opts?.force && suc.lat != null && suc.lng != null) {
    const dir = construirDireccionCompleta(suc.direccion, suc.numero)
    return {
      lat: suc.lat,
      lng: suc.lng,
      direccion: [suc.nombre, dir, suc.ciudad].filter(Boolean).join(' · '),
      fuente: 'sucursal',
    }
  }

  const geo = await geocodificarTexto(suc.direccion, suc.ciudad, suc.numero)
  if (!geo) return null

  await prisma.clienteSucursal.update({
    where: { id: sucursalId },
    data: { lat: geo.lat, lng: geo.lng },
  })

  const dir = construirDireccionCompleta(suc.direccion, suc.numero)
  return {
    lat: geo.lat,
    lng: geo.lng,
    direccion: [suc.nombre, dir ?? geo.displayName, suc.ciudad].filter(Boolean).join(' · '),
    fuente: 'sucursal',
  }
}

export async function geocodificarEquipoPorId(
  equipoId: string,
  opts?: { force?: boolean },
): Promise<UbicacionResuelta | null> {
  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    select: {
      id: true,
      ubicacionLat: true,
      ubicacionLng: true,
      direccionUbicacion: true,
      pisoSala: true,
      servicioInstalacion: true,
      sucursalId: true,
      clienteId: true,
      sucursal: { select: { id: true, nombre: true, direccion: true, numero: true, ciudad: true, lat: true, lng: true } },
      cliente: { select: { id: true, nombre: true, direccion: true, ciudad: true, lat: true, lng: true } },
    },
  })
  if (!equipo) return null

  const resuelto = await resolverUbicacionEquipoRecord(equipo, opts)
  if (!resuelto) return null

  if (resuelto.fuente === 'equipo_direccion' || resuelto.fuente === 'sucursal') {
    await prisma.equipo.update({
      where: { id: equipoId },
      data: {
        ubicacionLat: resuelto.lat,
        ubicacionLng: resuelto.lng,
        ...(resuelto.fuente === 'equipo_direccion' && !equipo.direccionUbicacion
          ? { direccionUbicacion: resuelto.direccion }
          : {}),
      },
    })
  }

  return resuelto
}

type EquipoUbicacionRecord = {
  ubicacionLat?: number | null
  ubicacionLng?: number | null
  direccionUbicacion?: string | null
  pisoSala?: string | null
  servicioInstalacion?: string | null
  sucursalId?: string | null
  clienteId: string
  sucursal?: {
    id: string
    nombre: string
    direccion?: string | null
    numero?: string | null
    ciudad?: string | null
    lat?: number | null
    lng?: number | null
  } | null
  cliente?: {
    id: string
    nombre: string
    direccion?: string | null
    ciudad?: string | null
    lat?: number | null
    lng?: number | null
  } | null
}

export async function resolverUbicacionEquipo(equipoId: string): Promise<UbicacionResuelta | null> {
  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    select: {
      ubicacionLat: true,
      ubicacionLng: true,
      direccionUbicacion: true,
      pisoSala: true,
      servicioInstalacion: true,
      sucursalId: true,
      clienteId: true,
      sucursal: { select: { id: true, nombre: true, direccion: true, numero: true, ciudad: true, lat: true, lng: true } },
      cliente: { select: { id: true, nombre: true, direccion: true, ciudad: true, lat: true, lng: true } },
    },
  })
  if (!equipo) return null
  return resolverUbicacionEquipoRecord(equipo)
}

export async function resolverUbicacionEquipoRecord(
  equipo: EquipoUbicacionRecord,
  opts?: { force?: boolean },
): Promise<UbicacionResuelta | null> {
  const etiqueta = etiquetaUbicacionEquipo(equipo)

  if (!opts?.force && equipo.ubicacionLat != null && equipo.ubicacionLng != null) {
    return {
      lat: equipo.ubicacionLat,
      lng: equipo.ubicacionLng,
      direccion: etiqueta,
      fuente: 'equipo_coords',
    }
  }

  if (equipo.direccionUbicacion?.trim()) {
    const geo = await geocodificarTexto(
      [equipo.direccionUbicacion, equipo.pisoSala].filter(Boolean).join(', '),
      equipo.cliente?.ciudad ?? equipo.sucursal?.ciudad,
    )
    if (geo) {
      return { lat: geo.lat, lng: geo.lng, direccion: etiqueta, fuente: 'equipo_direccion' }
    }
  }

  if (equipo.sucursal) {
    if (!opts?.force && equipo.sucursal.lat != null && equipo.sucursal.lng != null) {
      return {
        lat: equipo.sucursal.lat,
        lng: equipo.sucursal.lng,
        direccion: etiqueta,
        fuente: 'sucursal',
      }
    }
    const geoSuc = await geocodificarSucursalPorId(equipo.sucursal.id, opts)
    if (geoSuc) {
      return { ...geoSuc, direccion: etiqueta || geoSuc.direccion }
    }
  }

  if (equipo.sucursalId && !equipo.sucursal) {
    const geoSuc = await geocodificarSucursalPorId(equipo.sucursalId, opts)
    if (geoSuc) return geoSuc
  }

  const cliente = equipo.cliente ?? await prisma.cliente.findUnique({
    where: { id: equipo.clienteId },
    select: { id: true, nombre: true, direccion: true, ciudad: true, lat: true, lng: true },
  })
  if (!cliente) return null

  let lat = cliente.lat
  let lng = cliente.lng

  if (lat == null || lng == null) {
    const geo = await geocodificarTexto(cliente.direccion, cliente.ciudad)
    if (geo) {
      lat = geo.lat
      lng = geo.lng
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: { lat: geo.lat, lng: geo.lng },
      })
    }
  }

  if (lat == null || lng == null) return null

  return {
    lat,
    lng,
    direccion: etiqueta !== 'Ubicación no definida' ? etiqueta : direccionClienteLabel(cliente),
    fuente: 'cliente',
  }
}
