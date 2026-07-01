import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { devolverUnidadDeAlquiler } from '@/lib/inventario/unidades'
import { UBICACION_IB } from '@/lib/tracking'
import { finalizarAsignacionesActivas } from '@/lib/equipos/asignaciones'

type Tx = Prisma.TransactionClient

export async function devolverLineaAlquiler(
  lineaId: string,
  opts?: { usuarioId?: string | null; nota?: string | null },
  tx?: Tx,
) {
  const run = async (db: Tx) => {
    const linea = await db.lineaAlquiler.findUnique({
      where: { id: lineaId },
      include: {
        contrato: { select: { id: true, estado: true, numero: true } },
        inventarioUnidad: { select: { id: true, inventarioId: true, estado: true } },
        equipo: { select: { id: true } },
      },
    })

    if (!linea) throw new ApiError(404, 'Línea no encontrada')
    if (!linea.activa) throw new ApiError(400, 'La línea ya fue devuelta')
    if (!['ACTIVO', 'SUSPENDIDO'].includes(linea.contrato.estado)) {
      throw new ApiError(400, 'El contrato no permite devoluciones en este estado')
    }

    await devolverUnidadDeAlquiler(linea.inventarioUnidadId, db)

    if (linea.equipoId) {
      await finalizarAsignacionesActivas(db, linea.equipoId, new Date())
      await db.equipo.update({
        where: { id: linea.equipoId },
        data: {
          ubicacionLat: UBICACION_IB.lat,
          ubicacionLng: UBICACION_IB.lng,
          direccionUbicacion: UBICACION_IB.direccion,
        },
      })
      await db.eventoTracking.create({
        data: {
          equipoId: linea.equipoId,
          tipo: 'RETIRO',
          lat: UBICACION_IB.lat,
          lng: UBICACION_IB.lng,
          direccion: UBICACION_IB.direccion,
          nota: opts?.nota ?? `Devolución alquiler — contrato ${linea.contrato.numero}`,
          usuarioId: opts?.usuarioId ?? null,
        },
      })
    }

    await db.lineaAlquiler.update({
      where: { id: lineaId },
      data: { activa: false, fechaDevolucion: new Date() },
    })

    await db.cuotaAlquiler.updateMany({
      where: {
        lineaId,
        estado: { in: ['PENDIENTE', 'VENCIDA'] },
        facturaId: null,
      },
      data: { estado: 'ANULADA' },
    })

    return db.lineaAlquiler.findUnique({
      where: { id: lineaId },
      include: {
        inventarioUnidad: { select: { id: true, numeroSerie: true, estado: true } },
        equipo: { select: { id: true, nombre: true } },
      },
    })
  }

  if (tx) return run(tx)
  return prisma.$transaction(run)
}
