/**
 * Hooks automáticos de tracking geográfico (venta, OT, preventivo, cliente).
 */
import { addDays } from 'date-fns'
import type { TipoEventoTracking, TipoOT } from '@prisma/client'
import { geocodificarClientePorId } from '@/lib/clientes/geocodificar-cliente'
import { resolverUbicacionEquipo } from '@/lib/equipos/resolver-ubicacion-equipo'
import { registrarEventoTracking, UBICACION_IB } from '@/lib/tracking'

export interface CoordsInstalacion {
  lat: number
  lng: number
  direccion: string
}

async function resolverCoordsEquipo(equipoId: string): Promise<CoordsInstalacion | null> {
  const ubicacion = await resolverUbicacionEquipo(equipoId)
  if (!ubicacion) return null
  return { lat: ubicacion.lat, lng: ubicacion.lng, direccion: ubicacion.direccion }
}

/** Ciclo completo al vender/provisionar: IB → depósito → tránsito → instalado. */
export async function registrarCicloInstalacionDesdeVenta(opts: {
  equipoId: string
  clienteId: string
  usuarioId?: string | null
  referencia?: string
  fechaBase?: Date
}) {
  await geocodificarClientePorId(opts.clienteId).catch(() => null)
  const coords = await resolverCoordsEquipo(opts.equipoId)

  if (!coords) {
    await registrarEventoTracking({
      equipoId: opts.equipoId,
      tipo: 'DEPOSITO',
      lat: UBICACION_IB.lat,
      lng: UBICACION_IB.lng,
      direccion: UBICACION_IB.direccion,
      nota: opts.referencia ? `Alta por venta — ${opts.referencia}` : 'Alta por venta',
      usuarioId: opts.usuarioId ?? null,
      fecha: opts.fechaBase ?? new Date(),
    })
    return
  }

  const base = opts.fechaBase ?? new Date()
  const ref = opts.referencia ?? 'venta'
  const eventos: Array<{
    tipo: TipoEventoTracking
    dias: number
    lat: number
    lng: number
    dir: string
    nota: string
  }> = [
    {
      tipo: 'RECEPCION',
      dias: -4,
      lat: UBICACION_IB.lat,
      lng: UBICACION_IB.lng,
      dir: UBICACION_IB.direccion,
      nota: `Recepción automática — ${ref}`,
    },
    {
      tipo: 'DEPOSITO',
      dias: -3,
      lat: UBICACION_IB.lat,
      lng: UBICACION_IB.lng,
      dir: 'Depósito Central',
      nota: `En depósito — ${ref}`,
    },
    {
      tipo: 'EN_TRANSITO',
      dias: -1,
      lat: (UBICACION_IB.lat + coords.lat) / 2,
      lng: (UBICACION_IB.lng + coords.lng) / 2,
      dir: 'Ruta a sucursal de instalación',
      nota: `En tránsito — ${ref}`,
    },
    {
      tipo: 'INSTALADO',
      dias: 0,
      lat: coords.lat,
      lng: coords.lng,
      dir: coords.direccion,
      nota: `Instalado — ${ref}`,
    },
  ]

  for (const ev of eventos) {
    await registrarEventoTracking({
      equipoId: opts.equipoId,
      tipo: ev.tipo,
      lat: ev.lat,
      lng: ev.lng,
      direccion: ev.dir,
      nota: ev.nota,
      usuarioId: opts.usuarioId ?? null,
      fecha: addDays(base, ev.dias),
    })
  }
}

export async function registrarInstalacionEnCliente(opts: {
  equipoId: string
  clienteId: string
  usuarioId?: string | null
  otId?: string | null
  nota?: string | null
  direccionOverride?: string | null
}) {
  const coords = await resolverCoordsEquipo(opts.equipoId)
  if (!coords) return false

  await registrarEventoTracking({
    equipoId: opts.equipoId,
    tipo: 'INSTALADO',
    lat: coords.lat,
    lng: coords.lng,
    direccion: opts.direccionOverride ?? coords.direccion,
    nota: opts.nota ?? null,
    otId: opts.otId ?? null,
    usuarioId: opts.usuarioId ?? null,
  })
  return true
}

export async function registrarEventoVisitaTecnica(opts: {
  equipoId: string
  clienteId: string
  tipo: Extract<TipoEventoTracking, 'EN_SERVICIO' | 'INSTALADO'>
  usuarioId?: string | null
  otId?: string | null
  nota?: string | null
}) {
  const coords = await resolverCoordsEquipo(opts.equipoId)
  if (!coords) return false

  await registrarEventoTracking({
    equipoId: opts.equipoId,
    tipo: opts.tipo,
    lat: coords.lat,
    lng: coords.lng,
    direccion: coords.direccion,
    nota: opts.nota ?? null,
    otId: opts.otId ?? null,
    usuarioId: opts.usuarioId ?? null,
  })
  return true
}

const TIPOS_VISITA_CAMPO: TipoOT[] = ['CORRECTIVO', 'PREVENTIVO', 'GARANTIA', 'CALIBRACION', 'INSTALACION']

export async function sincronizarTrackingOt(opts: {
  otId: string
  numero: string
  tipo: TipoOT
  estadoAnterior: string
  estadoNuevo: string
  equipoId: string | null
  clienteId: string
  usuarioId?: string | null
  nota?: string | null
}) {
  if (!opts.equipoId || !TIPOS_VISITA_CAMPO.includes(opts.tipo)) return

  if (opts.estadoNuevo === 'EN_PROCESO' && opts.estadoAnterior !== 'EN_PROCESO') {
    await registrarEventoVisitaTecnica({
      equipoId: opts.equipoId,
      clienteId: opts.clienteId,
      tipo: 'EN_SERVICIO',
      otId: opts.otId,
      usuarioId: opts.usuarioId,
      nota: opts.nota ?? `OT ${opts.numero} — técnico en sitio`,
    })
    return
  }

  if (opts.estadoNuevo === 'CERRADA' && opts.estadoAnterior !== 'CERRADA') {
    if (opts.tipo === 'INSTALACION') {
      await registrarInstalacionEnCliente({
        equipoId: opts.equipoId,
        clienteId: opts.clienteId,
        otId: opts.otId,
        usuarioId: opts.usuarioId,
        nota: opts.nota ?? `Instalación completada — OT ${opts.numero}`,
      })
    } else {
      await registrarEventoVisitaTecnica({
        equipoId: opts.equipoId,
        clienteId: opts.clienteId,
        tipo: 'INSTALADO',
        otId: opts.otId,
        usuarioId: opts.usuarioId,
        nota: opts.nota ?? `OT ${opts.numero} cerrada — equipo en sitio`,
      })
    }
  }
}

export async function sincronizarTrackingPreventivoCompletado(opts: {
  equipoId: string
  clienteId: string
  planId: string
  descripcion: string
  usuarioId?: string | null
}) {
  await registrarEventoVisitaTecnica({
    equipoId: opts.equipoId,
    clienteId: opts.clienteId,
    tipo: 'INSTALADO',
    nota: `Preventivo completado: ${opts.descripcion}`,
    usuarioId: opts.usuarioId,
  })
}

/** Solo equipos sin sucursal ni dirección propia heredan coords del cliente fiscal. */
export async function refrescarUbicacionEquiposCliente(clienteId: string) {
  const { propagarCoordenadasAEquiposSinUbicacion, geocodificarClientePorId } = await import(
    '@/lib/clientes/geocodificar-cliente'
  )
  const clienteCoords = await geocodificarClientePorId(clienteId)
  if (!clienteCoords) return
  await propagarCoordenadasAEquiposSinUbicacion(
    clienteId,
    clienteCoords.lat,
    clienteCoords.lng,
    undefined,
  )
}
