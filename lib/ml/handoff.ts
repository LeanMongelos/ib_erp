/**
 * lib/ml/handoff.ts
 * Fuente única de la forma de datos que exponemos al partner ML (visión).
 *
 * Reutilizado por:
 *  - `scripts/export-ml-handoff.ts` (export estático JSON, schemaVersion 2)
 *  - `app/api/ml/clientes/route.ts` y `app/api/ml/equipos/[id]/route.ts` (API lectura con token)
 *
 * Solo campos acotados para ML (marca / modelo / serie / estado / cliente / asignación).
 * NO expone datos de contacto (CUIT, email, teléfono) — ver docs/HANDOFF-INTEGRACION-ML-VISION.md §3.
 * Todas las fechas se devuelven como ISO string; el catálogo expone solo `tieneFotoReferencia` (boolean).
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HANDOFF_CLIENTES } from '@/lib/equipos/seed-ml-handoff'

export type MlInventario = {
  sku: string | null
  nombre: string
  marca: string | null
  modelo: string | null
  descripcion: string | null
  tieneFotoReferencia: boolean
}

export type MlAsignacion = {
  id: string
  clienteId: string
  clienteNombre: string
  sucursalNombre: string | null
  tipo: string
  vigenciaDesde: string
  vigenciaHasta: string | null
  activa: boolean
  motivo: string | null
}

export type MlEquipo = {
  id: string
  nombre: string
  marca: string | null
  modelo: string | null
  numeroSerie: string | null
  estado: string
  origen: string
  inventario?: MlInventario
  asignacionActivaId: string | null
  asignaciones: MlAsignacion[]
}

export type MlCliente = {
  id: string
  nombre: string
  tipo: string
  ciudad: string | null
  activo: boolean
  equipos: MlEquipo[]
}

export type MlClienteResumen = {
  id: string
  nombre: string
  tipo: string
  ciudad: string | null
  activo: boolean
  cantidadEquipos: number
}

/** `select` Prisma del equipo con los campos acotados para ML. */
export const EQUIPO_ML_SELECT = {
  id: true,
  nombre: true,
  marca: true,
  modelo: true,
  numeroSerie: true,
  estado: true,
  origen: true,
  inventario: {
    select: {
      sku: true,
      nombre: true,
      marca: true,
      modelo: true,
      descripcion: true,
      fotoUrl: true,
    },
  },
  asignaciones: {
    orderBy: [{ vigenciaDesde: 'desc' }, { creadoEn: 'desc' }],
    select: {
      id: true,
      clienteId: true,
      tipo: true,
      vigenciaDesde: true,
      vigenciaHasta: true,
      activa: true,
      motivo: true,
      cliente: { select: { nombre: true } },
      sucursal: { select: { nombre: true } },
    },
  },
} satisfies Prisma.EquipoSelect

/** `select` Prisma del cliente + sus equipos (acotado ML). */
export const CLIENTE_ML_SELECT = {
  id: true,
  nombre: true,
  tipo: true,
  ciudad: true,
  activo: true,
  equipos: {
    orderBy: { creadoEn: 'asc' },
    select: EQUIPO_ML_SELECT,
  },
} satisfies Prisma.ClienteSelect

export function mapInventario(inv: {
  sku: string | null
  nombre: string
  marca: string | null
  modelo: string | null
  descripcion: string | null
  fotoUrl: string | null
}): MlInventario {
  return {
    sku: inv.sku,
    nombre: inv.nombre,
    marca: inv.marca,
    modelo: inv.modelo,
    descripcion: inv.descripcion,
    tieneFotoReferencia: Boolean(inv.fotoUrl?.trim()),
  }
}

export function mapAsignaciones(
  rows: Array<{
    id: string
    clienteId: string
    tipo: string
    vigenciaDesde: Date
    vigenciaHasta: Date | null
    activa: boolean
    motivo: string | null
    cliente: { nombre: string }
    sucursal: { nombre: string } | null
  }>,
): MlAsignacion[] {
  return rows.map((a) => ({
    id: a.id,
    clienteId: a.clienteId,
    clienteNombre: a.cliente.nombre,
    sucursalNombre: a.sucursal?.nombre ?? null,
    tipo: a.tipo,
    vigenciaDesde: a.vigenciaDesde.toISOString(),
    vigenciaHasta: a.vigenciaHasta?.toISOString() ?? null,
    activa: a.activa,
    motivo: a.motivo,
  }))
}

export function mapEquipo(e: {
  id: string
  nombre: string
  marca: string | null
  modelo: string | null
  numeroSerie: string | null
  estado: string
  origen: string
  inventario: {
    sku: string | null
    nombre: string
    marca: string | null
    modelo: string | null
    descripcion: string | null
    fotoUrl: string | null
  } | null
  asignaciones: Array<{
    id: string
    clienteId: string
    tipo: string
    vigenciaDesde: Date
    vigenciaHasta: Date | null
    activa: boolean
    motivo: string | null
    cliente: { nombre: string }
    sucursal: { nombre: string } | null
  }>
}): MlEquipo {
  const asignaciones = mapAsignaciones(e.asignaciones)
  const activa = asignaciones.find((a) => a.activa)
  return {
    id: e.id,
    nombre: e.nombre,
    marca: e.marca,
    modelo: e.modelo,
    numeroSerie: e.numeroSerie,
    estado: e.estado,
    origen: e.origen,
    ...(e.inventario ? { inventario: mapInventario(e.inventario) } : {}),
    asignacionActivaId: activa?.id ?? null,
    asignaciones,
  }
}

export function mapCliente(c: {
  id: string
  nombre: string
  tipo: string
  ciudad: string | null
  activo: boolean
  equipos: Parameters<typeof mapEquipo>[0][]
}): MlCliente {
  return {
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    ciudad: c.ciudad,
    activo: c.activo,
    equipos: c.equipos.map(mapEquipo),
  }
}

/** Clientes handoff (los 5 del seed) con equipos + asignaciones. Usado por el export estático. */
export async function getClientesHandoffMl(): Promise<MlCliente[]> {
  const rows = await prisma.cliente.findMany({
    where: { nombre: { in: [...HANDOFF_CLIENTES] } },
    orderBy: { nombre: 'asc' },
    select: CLIENTE_ML_SELECT,
  })
  return rows.map(mapCliente)
}

/** Resumen (sin equipos) de los clientes activos que no son handoff. Usado por el export estático. */
export async function getOtrosClientesMl(): Promise<MlClienteResumen[]> {
  const rows = await prisma.cliente.findMany({
    where: { nombre: { notIn: [...HANDOFF_CLIENTES] }, activo: true },
    orderBy: { nombre: 'asc' },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      ciudad: true,
      activo: true,
      _count: { select: { equipos: true } },
    },
  })
  return rows.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    ciudad: c.ciudad,
    activo: c.activo,
    cantidadEquipos: c._count.equipos,
  }))
}

/**
 * Clientes activos (todos, u opcionalmente uno) con equipos + asignaciones acotados.
 * Usado por la API de lectura del partner ML.
 */
export async function getClientesMl(opts?: { clienteId?: string }): Promise<MlCliente[]> {
  const rows = await prisma.cliente.findMany({
    where: {
      activo: true,
      ...(opts?.clienteId ? { id: opts.clienteId } : {}),
    },
    orderBy: { nombre: 'asc' },
    select: CLIENTE_ML_SELECT,
  })
  return rows.map(mapCliente)
}

/** Ficha acotada de un equipo por id (incluye clienteId/clienteNombre). `null` si no existe. */
export async function getEquipoMl(
  id: string,
): Promise<(MlEquipo & { clienteId: string; clienteNombre: string }) | null> {
  const e = await prisma.equipo.findUnique({
    where: { id },
    select: {
      ...EQUIPO_ML_SELECT,
      clienteId: true,
      cliente: { select: { nombre: true } },
    },
  })
  if (!e) return null
  const { clienteId, cliente, ...equipo } = e
  return {
    clienteId,
    clienteNombre: cliente?.nombre ?? '',
    ...mapEquipo(equipo),
  }
}
