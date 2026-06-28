/**
 * lib/tracking.ts — registro de eventos geolocalizados del ciclo de vida del equipo.
 */

import { prisma } from '@/lib/prisma'
import { construirDireccionCompleta } from '@/lib/geocoding'
import type { TipoEventoTracking, EstadoEquipo, OrigenEquipo } from '@prisma/client'

export const UBICACION_IB = {
  lat: -26.1849,
  lng: -58.1731,
  direccion: 'Eva Perón Nº679, Formosa',
}

const TIPO_LABEL: Record<TipoEventoTracking, string> = {
  RECEPCION: 'Recepción en local',
  DEPOSITO: 'En depósito',
  EN_TRANSITO: 'En tránsito',
  INSTALADO: 'Instalado en cliente',
  EN_SERVICIO: 'En servicio técnico',
  RETIRO: 'Retiro del cliente',
  BAJA: 'Baja / devolución',
}

export function labelTipoEvento(tipo: TipoEventoTracking) {
  return TIPO_LABEL[tipo] ?? tipo
}

function estadoDesdeTipo(tipo: TipoEventoTracking): EstadoEquipo | undefined {
  if (tipo === 'BAJA') return 'BAJA'
  if (tipo === 'EN_SERVICIO') return 'EN_REPARACION'
  if (['INSTALADO', 'RECEPCION', 'DEPOSITO', 'EN_TRANSITO', 'RETIRO'].includes(tipo)) return 'ACTIVO'
  return undefined
}

export async function registrarEventoTracking(opts: {
  equipoId: string
  tipo: TipoEventoTracking
  lat: number
  lng: number
  direccion?: string | null
  nota?: string | null
  fotoUrl?: string | null
  otId?: string | null
  usuarioId?: string | null
  fecha?: Date
}) {
  const evento = await prisma.$transaction(async (tx) => {
    const created = await tx.eventoTracking.create({
      data: {
        equipoId: opts.equipoId,
        tipo: opts.tipo,
        lat: opts.lat,
        lng: opts.lng,
        direccion: opts.direccion ?? null,
        nota: opts.nota ?? null,
        fotoUrl: opts.fotoUrl ?? null,
        otId: opts.otId ?? null,
        usuarioId: opts.usuarioId ?? null,
        fecha: opts.fecha ?? new Date(),
      },
      include: {
        equipo: { select: { nombre: true, numeroSerie: true } },
        usuario: { select: { nombre: true } },
      },
    })

    const nuevoEstado = estadoDesdeTipo(opts.tipo)
    await tx.equipo.update({
      where: { id: opts.equipoId },
      data: {
        ubicacionLat: opts.lat,
        ubicacionLng: opts.lng,
        direccionUbicacion: opts.direccion ?? undefined,
        ...(nuevoEstado && { estado: nuevoEstado }),
      },
    })

    return created
  })

  return evento
}

export async function getEquiposParaMapa(filtros?: {
  clienteId?: string
  estado?: EstadoEquipo
  origen?: OrigenEquipo | 'TODOS'
}) {
  const origenFilter =
    filtros?.origen && filtros.origen !== 'TODOS' ? { origen: filtros.origen } : {}

  const equipos = await prisma.equipo.findMany({
    where: {
      ...(filtros?.clienteId && { clienteId: filtros.clienteId }),
      ...(filtros?.estado && { estado: filtros.estado }),
      ...origenFilter,
    },
    include: {
      cliente: {
        select: {
          id: true,
          nombre: true,
          ciudad: true,
          lat: true,
          lng: true,
          direccion: true,
          sucursales: {
            where: { activo: true, lat: { not: null }, lng: { not: null } },
            orderBy: { creadoEn: 'asc' },
            take: 1,
            select: { lat: true, lng: true, nombre: true, direccion: true, numero: true, ciudad: true },
          },
        },
      },
      sucursal: { select: { id: true, nombre: true, direccion: true, numero: true, ciudad: true, lat: true, lng: true } },
      lineasAlquiler: {
        where: { activa: true, contrato: { estado: 'ACTIVO' } },
        orderBy: { creadoEn: 'desc' },
        take: 1,
        select: {
          beneficiarioNombre: true,
          domicilio: true,
          localidad: true,
          lat: true,
          lng: true,
        },
      },
      eventos: {
        orderBy: { fecha: 'desc' },
        take: 1,
        select: { lat: true, lng: true, direccion: true },
      },
      planes: {
        where: { estado: { in: ['PROGRAMADO', 'PENDIENTE'] } },
        orderBy: { proximoServicio: 'asc' },
        take: 1,
      },
    },
    orderBy: { nombre: 'asc' },
  })

  return equipos.map((e) => {
    const ultimoEvento = e.eventos[0]
    const lineaAlq = e.origen === 'ALQUILER' ? e.lineasAlquiler[0] : undefined
    const sucursalGeo = e.sucursal?.lat != null ? e.sucursal : e.cliente.sucursales[0]
    const lat =
      (lineaAlq?.lat != null ? lineaAlq.lat : null) ??
      e.ubicacionLat ??
      sucursalGeo?.lat ??
      e.cliente.lat ??
      ultimoEvento?.lat
    const lng =
      (lineaAlq?.lng != null ? lineaAlq.lng : null) ??
      e.ubicacionLng ??
      sucursalGeo?.lng ??
      e.cliente.lng ??
      ultimoEvento?.lng
    const plan = e.planes[0]
    const proximo = plan?.proximoServicio
    const mantenimientoProximo = proximo
      ? Math.ceil((proximo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null
    const direccion =
      (lineaAlq?.domicilio
        ? [lineaAlq.beneficiarioNombre, lineaAlq.domicilio, lineaAlq.localidad].filter(Boolean).join(' · ')
        : null) ??
      e.direccionUbicacion ??
      ultimoEvento?.direccion ??
      (sucursalGeo
        ? [
            sucursalGeo.nombre,
            construirDireccionCompleta(sucursalGeo.direccion, sucursalGeo.numero),
            sucursalGeo.ciudad,
          ].filter(Boolean).join(' · ')
        : e.cliente.ciudad)
    return {
      id: e.id,
      nombre: e.nombre,
      marca: e.marca,
      modelo: e.modelo,
      numeroSerie: e.numeroSerie,
      estado: e.estado,
      origen: e.origen,
      lat,
      lng,
      direccion,
      cliente: e.cliente,
      beneficiario: lineaAlq?.beneficiarioNombre ?? null,
      mantenimientoProximoDias: mantenimientoProximo,
      mantenimientoVencido: mantenimientoProximo != null && mantenimientoProximo < 0,
    }
  }).filter((e) => e.lat != null && e.lng != null)
}

export async function getRecorridoEquipo(equipoId: string) {
  return prisma.eventoTracking.findMany({
    where: { equipoId },
    orderBy: { fecha: 'asc' },
    include: {
      usuario: { select: { nombre: true } },
      ot: { select: { numero: true } },
    },
  })
}
