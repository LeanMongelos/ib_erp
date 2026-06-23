/**
 * Datos demo de tracking geográfico para equipos del seed (mapa ST).
 * Idempotente: solo equipos activos sin coords ni eventos previos.
 */
import { addDays, subDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { UBICACION_IB } from '@/lib/tracking'

const OFFSETS = [
  { lat: 0, lng: 0 },
  { lat: 0.012, lng: -0.008 },
  { lat: -0.006, lng: 0.015 },
  { lat: 0.018, lng: 0.006 },
  { lat: -0.014, lng: -0.012 },
  { lat: 0.008, lng: -0.018 },
] as const

export async function seedTrackingDemo(opts?: { limit?: number }): Promise<number> {
  const limit = opts?.limit ?? 6

  const candidatos = await prisma.equipo.findMany({
    where: {
      ubicacionLat: null,
      estado: { not: 'BAJA' },
      eventos: { none: {} },
    },
    take: limit,
    orderBy: { creadoEn: 'asc' },
    include: { cliente: true },
  })

  let idx = 0
  for (const eq of candidatos) {
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

    idx++
  }

  return candidatos.length
}
