/**
 * Alta de equipo en parque del cliente sin tocar stock de inventario.
 */
import type { OrigenEquipo, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { crearAsignacionInicialEquipo } from '@/lib/equipos/asignaciones'

export type EquipoClienteInput = {
  nombre: string
  marca?: string | null
  modelo?: string | null
  numeroSerie?: string | null
  notasTecnicas?: string | null
}

type DbClient = Prisma.TransactionClient | typeof prisma

function contenidoHistoriaDefault(data: EquipoClienteInput, origen: OrigenEquipo): string {
  const numeroSerie = data.numeroSerie?.trim() || null
  const lineas = [
    data.marca && `Marca: ${data.marca}`,
    data.modelo && `Modelo: ${data.modelo}`,
    numeroSerie && `N° serie: ${numeroSerie}`,
    data.notasTecnicas && `Notas: ${data.notasTecnicas}`,
  ].filter(Boolean)

  if (lineas.length > 0) return lineas.join(' · ')

  if (origen === 'MANUAL_ST') {
    return 'Alta manual en servicio técnico (equipo externo o no inventariado).'
  }
  return 'Equipo externo registrado en ficha del cliente (sin movimiento de stock).'
}

export async function crearEquipoCliente(
  clienteId: string,
  data: EquipoClienteInput,
  opts: {
    origen: OrigenEquipo
    usuarioId?: string | null
    historia?: { titulo: string; contenido?: string | null }
  },
  tx?: Prisma.TransactionClient,
) {
  const db: DbClient = tx ?? prisma
  const numeroSerie = data.numeroSerie?.trim() || null

  if (numeroSerie) {
    const dup = await db.equipo.findUnique({
      where: { numeroSerie },
      select: { id: true, nombre: true },
    })
    if (dup) {
      throw new ApiError(
        409,
        `Ya existe un equipo con el número de serie «${numeroSerie}» (${dup.nombre}). Verificá el dato o seleccioná el equipo existente.`,
      )
    }
  }

  const equipo = await db.equipo.create({
    data: {
      nombre: data.nombre.trim(),
      marca: data.marca?.trim() || null,
      modelo: data.modelo?.trim() || null,
      numeroSerie,
      notasTecnicas: data.notasTecnicas?.trim() || null,
      clienteId,
      origen: opts.origen,
      estado: 'ACTIVO',
    },
  })

  const tituloHistoria =
    opts.historia?.titulo ??
    (opts.origen === 'MANUAL_ST'
      ? 'Equipo registrado desde orden de trabajo'
      : 'Equipo registrado en ficha del cliente')

  await db.historiaClinicaEntrada.create({
    data: {
      equipoId: equipo.id,
      tipo: 'NOTA',
      titulo: tituloHistoria,
      contenido:
        opts.historia?.contenido?.trim() ||
        contenidoHistoriaDefault(data, opts.origen),
      usuarioId: opts.usuarioId ?? null,
    },
  })

  await crearAsignacionInicialEquipo(
    {
      equipoId: equipo.id,
      clienteId,
      origen: opts.origen,
      usuarioId: opts.usuarioId,
    },
    db,
  )

  return equipo
}
