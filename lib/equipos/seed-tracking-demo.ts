/**
 * Backfill de coords para mapa ST (seed + VPS deploy).
 * Idempotente: copia desde eventos/sucursal/cliente; demo solo si no hay fuente.
 */
import { addDays, subDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { construirDireccionCompleta } from '@/lib/geocoding'
import { UBICACION_IB } from '@/lib/tracking'

const OFFSETS = [
  { lat: 0, lng: 0 },
  { lat: 0.012, lng: -0.008 },
  { lat: -0.006, lng: 0.015 },
  { lat: 0.018, lng: 0.006 },
  { lat: -0.014, lng: -0.012 },
  { lat: 0.008, lng: -0.018 },
] as const

export type BackfillUbicacionResult = {
  fromEvento: number
  fromSucursal: number
  fromSucursalCliente: number
  fromCliente: number
  demoCreados: number
  sinCoords: number
}

function direccionDesdeSucursal(s: {
  nombre: string
  direccion: string | null
  numero: string | null
  ciudad: string | null
}) {
  return [s.nombre, construirDireccionCompleta(s.direccion, s.numero), s.ciudad].filter(Boolean).join(' · ')
}

/** Copia coords existentes al equipo y crea demo solo donde no hay ninguna fuente. */
export async function backfillUbicacionEquipos(opts?: { demoLimit?: number }): Promise<BackfillUbicacionResult> {
  const demoLimit = opts?.demoLimit ?? 100
  const result: BackfillUbicacionResult = {
    fromEvento: 0,
    fromSucursal: 0,
    fromSucursalCliente: 0,
    fromCliente: 0,
    demoCreados: 0,
    sinCoords: 0,
  }

  const sinUbicacion = await prisma.equipo.findMany({
    where: { ubicacionLat: null, estado: { not: 'BAJA' } },
    include: {
      cliente: {
        select: {
          id: true,
          lat: true,
          lng: true,
          direccion: true,
          ciudad: true,
          sucursales: {
            where: { activo: true, lat: { not: null }, lng: { not: null } },
            orderBy: { creadoEn: 'asc' },
            take: 1,
            select: {
              lat: true,
              lng: true,
              nombre: true,
              direccion: true,
              numero: true,
              ciudad: true,
            },
          },
        },
      },
      sucursal: {
        select: {
          lat: true,
          lng: true,
          nombre: true,
          direccion: true,
          numero: true,
          ciudad: true,
        },
      },
      eventos: { orderBy: { fecha: 'desc' }, take: 1 },
    },
    orderBy: { creadoEn: 'asc' },
  })

  const pendientesDemo: Array<(typeof sinUbicacion)[number]> = []

  for (const eq of sinUbicacion) {
    const ev = eq.eventos[0]
    if (ev?.lat != null && ev?.lng != null) {
      await prisma.equipo.update({
        where: { id: eq.id },
        data: {
          ubicacionLat: ev.lat,
          ubicacionLng: ev.lng,
          direccionUbicacion: ev.direccion ?? undefined,
        },
      })
      result.fromEvento++
      continue
    }

    if (eq.sucursal?.lat != null && eq.sucursal?.lng != null) {
      await prisma.equipo.update({
        where: { id: eq.id },
        data: {
          ubicacionLat: eq.sucursal.lat,
          ubicacionLng: eq.sucursal.lng,
          direccionUbicacion: direccionDesdeSucursal(eq.sucursal),
        },
      })
      result.fromSucursal++
      continue
    }

    const sucCli = eq.cliente.sucursales[0]
    if (sucCli?.lat != null && sucCli?.lng != null) {
      await prisma.equipo.update({
        where: { id: eq.id },
        data: {
          ubicacionLat: sucCli.lat,
          ubicacionLng: sucCli.lng,
          direccionUbicacion: direccionDesdeSucursal(sucCli),
        },
      })
      result.fromSucursalCliente++
      continue
    }

    if (eq.cliente.lat != null && eq.cliente.lng != null) {
      await prisma.equipo.update({
        where: { id: eq.id },
        data: {
          ubicacionLat: eq.cliente.lat,
          ubicacionLng: eq.cliente.lng,
          direccionUbicacion: eq.cliente.direccion ?? eq.cliente.ciudad ?? undefined,
        },
      })
      result.fromCliente++
      continue
    }

    if (eq.eventos.length === 0) {
      pendientesDemo.push(eq)
    } else {
      result.sinCoords++
    }
  }

  let demoIdx = 0
  for (const eq of pendientesDemo.slice(0, demoLimit)) {
    await aplicarDemoTracking(eq, demoIdx)
    demoIdx++
    result.demoCreados++
  }

  result.sinCoords += Math.max(0, pendientesDemo.length - demoLimit)

  return result
}

async function aplicarDemoTracking(
  eq: {
    id: string
    clienteId: string
    cliente: { direccion: string | null; ciudad: string | null }
  },
  idx: number,
) {
  const off = OFFSETS[idx % OFFSETS.length]
  const latCli = UBICACION_IB.lat + off.lat
  const lngCli = UBICACION_IB.lng + off.lng

  await prisma.cliente.update({
    where: { id: eq.clienteId },
    data: { lat: latCli, lng: lngCli },
  })

  const base = subDays(new Date(), 30 - idx * 4)
  const eventos: Array<{
    tipo: 'RECEPCION' | 'DEPOSITO' | 'EN_TRANSITO' | 'INSTALADO'
    dias: number
    lat: number
    lng: number
    dir: string
  }> = [
    { tipo: 'RECEPCION', dias: 0, lat: UBICACION_IB.lat, lng: UBICACION_IB.lng, dir: UBICACION_IB.direccion },
    { tipo: 'DEPOSITO', dias: 1, lat: UBICACION_IB.lat, lng: UBICACION_IB.lng, dir: 'Depósito Central' },
    {
      tipo: 'EN_TRANSITO',
      dias: 3,
      lat: (UBICACION_IB.lat + latCli) / 2,
      lng: (UBICACION_IB.lng + lngCli) / 2,
      dir: 'Ruta a cliente',
    },
    {
      tipo: 'INSTALADO',
      dias: 5,
      lat: latCli,
      lng: lngCli,
      dir: eq.cliente.direccion ?? eq.cliente.ciudad ?? 'Cliente',
    },
  ]

  for (const ev of eventos) {
    await prisma.eventoTracking.create({
      data: {
        equipoId: eq.id,
        tipo: ev.tipo,
        lat: ev.lat,
        lng: ev.lng,
        direccion: ev.dir,
        fecha: addDays(base, ev.dias),
      },
    })
  }

  await prisma.equipo.update({
    where: { id: eq.id },
    data: {
      ubicacionLat: latCli,
      ubicacionLng: lngCli,
      direccionUbicacion: eq.cliente.direccion ?? eq.cliente.ciudad ?? undefined,
    },
  })
}

/** @deprecated Usar backfillUbicacionEquipos — mantiene compat con seed.ts */
export async function seedTrackingDemo(opts?: { limit?: number }): Promise<number> {
  const r = await backfillUbicacionEquipos({ demoLimit: opts?.limit ?? 6 })
  return r.fromEvento + r.fromSucursal + r.fromSucursalCliente + r.fromCliente + r.demoCreados
}
