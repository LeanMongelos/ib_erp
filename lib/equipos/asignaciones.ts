/**
 * Asignaciones vigentes e históricas equipo ↔ cliente.
 * `equipos.clienteId` refleja la asignación activa (denormalizado para consultas rápidas).
 */
import type { OrigenEquipo, Prisma, TipoAsignacionEquipo } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'

type DbClient = Prisma.TransactionClient | typeof prisma

export function origenATipoAsignacion(origen: OrigenEquipo): TipoAsignacionEquipo {
  switch (origen) {
    case 'ALQUILER':
      return 'ALQUILER'
    case 'EXTERNO':
      return 'EXTERNO'
    case 'MANUAL_ST':
      return 'MANUAL_ST'
    default:
      return 'VENTA'
  }
}

export async function finalizarAsignacionesActivas(
  db: DbClient,
  equipoId: string,
  vigenciaHasta: Date = new Date(),
) {
  await db.equipoAsignacion.updateMany({
    where: { equipoId, activa: true },
    data: { activa: false, vigenciaHasta },
  })
}

export type CrearAsignacionInput = {
  equipoId: string
  clienteId: string
  sucursalId?: string | null
  tipo: TipoAsignacionEquipo
  vigenciaDesde?: Date
  lineaAlquilerId?: string | null
  motivo?: string | null
  observaciones?: string | null
  usuarioId?: string | null
  /** Si true (default), cierra asignaciones activas previas del mismo equipo. */
  reemplazarActiva?: boolean
}

export async function crearAsignacionEquipo(
  input: CrearAsignacionInput,
  db: DbClient = prisma,
) {
  if (input.reemplazarActiva !== false) {
    await finalizarAsignacionesActivas(db, input.equipoId, input.vigenciaDesde ?? new Date())
  }

  return db.equipoAsignacion.create({
    data: {
      equipoId: input.equipoId,
      clienteId: input.clienteId,
      sucursalId: input.sucursalId ?? null,
      tipo: input.tipo,
      vigenciaDesde: input.vigenciaDesde ?? new Date(),
      activa: true,
      lineaAlquilerId: input.lineaAlquilerId ?? null,
      motivo: input.motivo?.trim() || null,
      observaciones: input.observaciones?.trim() || null,
      creadoPorId: input.usuarioId ?? null,
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      sucursal: { select: { id: true, nombre: true } },
    },
  })
}

/** Alta inicial al crear equipo (sin cerrar asignación previa). */
export async function crearAsignacionInicialEquipo(
  opts: {
    equipoId: string
    clienteId: string
    sucursalId?: string | null
    origen: OrigenEquipo
    vigenciaDesde?: Date
    lineaAlquilerId?: string | null
    usuarioId?: string | null
  },
  db: DbClient = prisma,
) {
  const existente = await db.equipoAsignacion.findFirst({
    where: { equipoId: opts.equipoId, activa: true },
    select: { id: true },
  })
  if (existente) return existente

  return crearAsignacionEquipo(
    {
      equipoId: opts.equipoId,
      clienteId: opts.clienteId,
      sucursalId: opts.sucursalId,
      tipo: origenATipoAsignacion(opts.origen),
      vigenciaDesde: opts.vigenciaDesde,
      lineaAlquilerId: opts.lineaAlquilerId,
      reemplazarActiva: false,
      usuarioId: opts.usuarioId,
    },
    db,
  )
}

export async function listarAsignacionesEquipo(equipoId: string) {
  return prisma.equipoAsignacion.findMany({
    where: { equipoId },
    orderBy: [{ vigenciaDesde: 'desc' }, { creadoEn: 'desc' }],
    include: {
      cliente: { select: { id: true, nombre: true, ciudad: true } },
      sucursal: { select: { id: true, nombre: true } },
      creadoPor: { select: { id: true, nombre: true } },
      lineaAlquiler: {
        select: {
          id: true,
          contrato: { select: { id: true, numero: true } },
        },
      },
    },
  })
}

export type TrasladarEquipoInput = {
  equipoId: string
  clienteIdDestino: string
  sucursalIdDestino?: string | null
  motivo?: string | null
  observaciones?: string | null
  usuarioId?: string | null
}

export async function trasladarEquipoACliente(input: TrasladarEquipoInput) {
  return prisma.$transaction(async (tx) => {
    const equipo = await tx.equipo.findUnique({
      where: { id: input.equipoId },
      include: {
        cliente: { select: { id: true, nombre: true } },
        asignaciones: { where: { activa: true }, take: 1 },
      },
    })
    if (!equipo) throw new ApiError(404, 'Equipo no encontrado')
    if (equipo.estado === 'BAJA') throw new ApiError(400, 'No se puede trasladar un equipo dado de baja')

    if (input.clienteIdDestino === equipo.clienteId && !input.sucursalIdDestino) {
      throw new ApiError(400, 'El equipo ya está asignado a ese cliente')
    }

    const clienteDestino = await tx.cliente.findUnique({
      where: { id: input.clienteIdDestino },
      select: { id: true, nombre: true, activo: true },
    })
    if (!clienteDestino?.activo) throw new ApiError(400, 'Cliente destino no válido o inactivo')

    if (input.sucursalIdDestino) {
      const suc = await tx.clienteSucursal.findFirst({
        where: {
          id: input.sucursalIdDestino,
          clienteId: input.clienteIdDestino,
          activo: true,
        },
      })
      if (!suc) throw new ApiError(400, 'La sucursal no pertenece al cliente destino')
    }

    const lineaAlqActiva = await tx.lineaAlquiler.findFirst({
      where: {
        equipoId: input.equipoId,
        activa: true,
        contrato: { estado: { in: ['ACTIVO', 'SUSPENDIDO'] } },
      },
      include: { contrato: { select: { numero: true } } },
    })
    if (lineaAlqActiva) {
      throw new ApiError(
        400,
        `El equipo está en alquiler activo (contrato ${lineaAlqActiva.contrato.numero}). Devolvé la unidad antes de trasladar.`,
      )
    }

    const ahora = new Date()
    await finalizarAsignacionesActivas(tx, input.equipoId, ahora)

    const asignacion = await crearAsignacionEquipo(
      {
        equipoId: input.equipoId,
        clienteId: input.clienteIdDestino,
        sucursalId: input.sucursalIdDestino,
        tipo: 'TRASLADO',
        vigenciaDesde: ahora,
        motivo: input.motivo,
        observaciones: input.observaciones,
        usuarioId: input.usuarioId,
        reemplazarActiva: false,
      },
      tx,
    )

    await tx.equipo.update({
      where: { id: input.equipoId },
      data: {
        clienteId: input.clienteIdDestino,
        sucursalId: input.sucursalIdDestino ?? null,
      },
    })

    const de = equipo.cliente.nombre
    const a = clienteDestino.nombre
    await tx.historiaClinicaEntrada.create({
      data: {
        equipoId: input.equipoId,
        tipo: 'CAMBIO_ASIGNACION',
        titulo: `Traslado: ${de} → ${a}`,
        contenido:
          [
            input.motivo?.trim(),
            input.observaciones?.trim(),
            input.sucursalIdDestino ? 'Sucursal actualizada.' : null,
          ]
            .filter(Boolean)
            .join(' · ') || null,
        referenciaId: asignacion.id,
        usuarioId: input.usuarioId ?? null,
        fecha: ahora,
      },
    })

    const { geocodificarEquipoPorId } = await import('@/lib/equipos/resolver-ubicacion-equipo')
    await geocodificarEquipoPorId(input.equipoId, { force: true }).catch(() => null)

    return asignacion
  })
}

/** Backfill: crea asignación activa desde equipos existentes sin historial. */
export async function backfillAsignacionesDesdeEquipos(): Promise<number> {
  const equipos = await prisma.equipo.findMany({
    select: {
      id: true,
      clienteId: true,
      sucursalId: true,
      origen: true,
      creadoEn: true,
    },
  })

  let creados = 0
  for (const eq of equipos) {
    const tiene = await prisma.equipoAsignacion.findFirst({
      where: { equipoId: eq.id },
      select: { id: true },
    })
    if (tiene) continue

    await crearAsignacionInicialEquipo({
      equipoId: eq.id,
      clienteId: eq.clienteId,
      sucursalId: eq.sucursalId,
      origen: eq.origen,
      vigenciaDesde: eq.creadoEn,
    })
    creados++
  }
  return creados
}
