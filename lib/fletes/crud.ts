import type { Prisma, EstadoFlete, TipoFlete } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { crearConNumeroUnico, siguienteNumeroFlete } from '@/lib/sequences'
import type { fleteCreateSchema, fleteUpdateSchema } from '@/lib/validation'
import type { z } from 'zod'

export const fleteInclude = {
  cliente: { select: { id: true, nombre: true } },
  proveedorOrigen: { select: { id: true, razonSocial: true } },
  ordenCompra: { select: { id: true, numero: true, estado: true } },
  remitoVenta: { select: { id: true, numero: true, estado: true } },
  facturaCompra: { select: { id: true, numero: true } },
  factura: { select: { id: true, numero: true } },
  creadoPor: { select: { id: true, nombre: true } },
} satisfies Prisma.SeguimientoFleteInclude

export type FleteCreateInput = z.infer<typeof fleteCreateSchema>
export type FleteUpdateInput = z.infer<typeof fleteUpdateSchema>

export function calcularEstado(flete: {
  estado: EstadoFlete
  fechaRecibido?: Date | null
  guiaSeguimiento?: string | null
  transportista?: string | null
  fechaEnvio?: Date | null
}): EstadoFlete {
  if (flete.estado === 'CANCELADO') return 'CANCELADO'
  if (flete.fechaRecibido) return 'RECIBIDO'
  const tieneSeguimiento =
    Boolean(flete.guiaSeguimiento?.trim()) ||
    Boolean(flete.transportista?.trim()) ||
    Boolean(flete.fechaEnvio)
  if (tieneSeguimiento) return 'EN_TRANSITO'
  return 'BORRADOR'
}

function buildListWhere(params: {
  tipo?: TipoFlete
  estado?: EstadoFlete
  q?: string
  ordenCompraId?: string
  remitoVentaId?: string
}): Prisma.SeguimientoFleteWhereInput {
  const q = params.q?.trim()
  return {
    ...(params.tipo && { tipo: params.tipo }),
    ...(params.estado && { estado: params.estado }),
    ...(params.ordenCompraId && { ordenCompraId: params.ordenCompraId }),
    ...(params.remitoVentaId && { remitoVentaId: params.remitoVentaId }),
    ...(q && {
      OR: [
        { numero: { contains: q, mode: 'insensitive' } },
        { guiaSeguimiento: { contains: q, mode: 'insensitive' } },
        { transportista: { contains: q, mode: 'insensitive' } },
        { clienteNombre: { contains: q, mode: 'insensitive' } },
        { proveedorOrigenNombre: { contains: q, mode: 'insensitive' } },
        { facturaTransporte: { contains: q, mode: 'insensitive' } },
        { observaciones: { contains: q, mode: 'insensitive' } },
      ],
    }),
  }
}

export async function listarFletes(params: {
  tipo?: TipoFlete
  estado?: EstadoFlete
  q?: string
  ordenCompraId?: string
  remitoVentaId?: string
  take?: number
}) {
  return prisma.seguimientoFlete.findMany({
    where: buildListWhere(params),
    orderBy: [{ fechaEnvio: 'desc' }, { creadoEn: 'desc' }],
    take: params.take ?? 500,
    include: fleteInclude,
  })
}

export async function obtenerFlete(id: string) {
  const flete = await prisma.seguimientoFlete.findUnique({
    where: { id },
    include: fleteInclude,
  })
  if (!flete) throw new ApiError(404, 'Seguimiento de flete no encontrado')
  return flete
}

export async function crearFlete(data: FleteCreateInput, creadoPorId?: string) {
  const estadoManual = data.estado
  const base = {
    tipo: data.tipo,
    fechaEnvio: data.fechaEnvio ?? null,
    fechaRecibido: data.fechaRecibido ?? null,
    transportista: data.transportista?.trim() || null,
    guiaSeguimiento: data.guiaSeguimiento?.trim() || null,
    importe: data.importe ?? null,
    observaciones: data.observaciones?.trim() || null,
    proveedorOrigenNombre: data.proveedorOrigenNombre?.trim() || null,
    clienteNombre: data.clienteNombre?.trim() || null,
    facturaTransporte: data.facturaTransporte?.trim() || null,
    ordenCompraId: data.ordenCompraId ?? null,
    remitoVentaId: data.remitoVentaId ?? null,
    facturaCompraId: data.facturaCompraId ?? null,
    facturaId: data.facturaId ?? null,
    clienteId: data.clienteId ?? null,
    proveedorOrigenId: data.proveedorOrigenId ?? null,
    creadoPorId: creadoPorId ?? null,
  }

  const estado = estadoManual ?? calcularEstado({ ...base, estado: 'BORRADOR' })

  return crearConNumeroUnico(siguienteNumeroFlete, (numero) =>
    prisma.seguimientoFlete.create({
      data: { numero, ...base, estado },
      include: fleteInclude,
    }),
  )
}

export async function actualizarFlete(id: string, data: FleteUpdateInput) {
  const actual = await obtenerFlete(id)

  const merged = {
    tipo: data.tipo ?? actual.tipo,
    fechaEnvio: data.fechaEnvio !== undefined ? data.fechaEnvio : actual.fechaEnvio,
    fechaRecibido: data.fechaRecibido !== undefined ? data.fechaRecibido : actual.fechaRecibido,
    transportista:
      data.transportista !== undefined ? data.transportista?.trim() || null : actual.transportista,
    guiaSeguimiento:
      data.guiaSeguimiento !== undefined
        ? data.guiaSeguimiento?.trim() || null
        : actual.guiaSeguimiento,
    importe: data.importe !== undefined ? data.importe : actual.importe,
    observaciones:
      data.observaciones !== undefined ? data.observaciones?.trim() || null : actual.observaciones,
    proveedorOrigenNombre:
      data.proveedorOrigenNombre !== undefined
        ? data.proveedorOrigenNombre?.trim() || null
        : actual.proveedorOrigenNombre,
    clienteNombre:
      data.clienteNombre !== undefined ? data.clienteNombre?.trim() || null : actual.clienteNombre,
    facturaTransporte:
      data.facturaTransporte !== undefined
        ? data.facturaTransporte?.trim() || null
        : actual.facturaTransporte,
    ordenCompraId:
      data.ordenCompraId !== undefined ? data.ordenCompraId : actual.ordenCompraId,
    remitoVentaId: data.remitoVentaId !== undefined ? data.remitoVentaId : actual.remitoVentaId,
    facturaCompraId:
      data.facturaCompraId !== undefined ? data.facturaCompraId : actual.facturaCompraId,
    facturaId: data.facturaId !== undefined ? data.facturaId : actual.facturaId,
    clienteId: data.clienteId !== undefined ? data.clienteId : actual.clienteId,
    proveedorOrigenId:
      data.proveedorOrigenId !== undefined ? data.proveedorOrigenId : actual.proveedorOrigenId,
  }

  const estado =
    data.estado ??
    (actual.estado === 'CANCELADO'
      ? 'CANCELADO'
      : calcularEstado({ ...merged, estado: 'BORRADOR' }))

  return prisma.seguimientoFlete.update({
    where: { id },
    data: { ...merged, estado },
    include: fleteInclude,
  })
}
