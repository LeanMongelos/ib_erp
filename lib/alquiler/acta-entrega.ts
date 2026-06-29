/**
 * ACTA de entrega de equipos en alquiler — lógica de negocio y persistencia.
 */
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { crearConNumeroUnico, siguienteNumeroActaAlquiler } from '@/lib/sequences'
import { buildActaEntregaDefaults, type ActaEntregaFormValues } from '@/lib/alquiler/acta-entrega-client'
import { formatPeriodo } from '@/lib/alquiler/periodo'
import type { actaEntregaAlquilerCreateSchema, actaEntregaAlquilerUpdateSchema } from '@/lib/validation'
import type { z } from 'zod'

type CreateInput = z.infer<typeof actaEntregaAlquilerCreateSchema>
type UpdateInput = z.infer<typeof actaEntregaAlquilerUpdateSchema>

const actaInclude = {
  contrato: { select: { id: true, numero: true } },
  linea: {
    select: {
      id: true,
      inventarioUnidad: {
        select: {
          numeroSerie: true,
          inventario: { select: { nombre: true, marca: true, modelo: true } },
        },
      },
    },
  },
  factura: { select: { id: true, numero: true, estado: true } },
  creadoPor: { select: { id: true, nombre: true } },
} as const

async function cargarLineaContrato(contratoId: string, lineaId: string) {
  const contrato = await prisma.contratoAlquiler.findUnique({
    where: { id: contratoId },
    include: {
      cliente: { select: { nombre: true, telefono: true } },
      lineas: {
        where: { id: lineaId },
        include: {
          inventarioUnidad: {
            select: {
              numeroSerie: true,
              inventario: { select: { nombre: true, marca: true, modelo: true } },
            },
          },
          equipo: { select: { nombre: true, numeroSerie: true } },
        },
      },
    },
  })

  if (!contrato) throw new ApiError(404, 'Contrato no encontrado')
  const linea = contrato.lineas[0]
  if (!linea) throw new ApiError(404, 'Línea no encontrada en este contrato')
  if (!['ACTIVO', 'SUSPENDIDO', 'FINALIZADO'].includes(contrato.estado)) {
    throw new ApiError(400, 'Solo se puede generar ACTA en contratos activos, suspendidos o finalizados')
  }

  return { contrato, linea }
}

function mergeConDefaults(
  defaults: ActaEntregaFormValues,
  overrides: CreateInput | UpdateInput,
): ActaEntregaFormValues {
  return {
    clienteNombre: overrides.clienteNombre ?? defaults.clienteNombre,
    clienteDni: overrides.clienteDni !== undefined ? (overrides.clienteDni ?? '') : defaults.clienteDni,
    clienteDireccion:
      overrides.clienteDireccion !== undefined
        ? (overrides.clienteDireccion ?? '')
        : defaults.clienteDireccion,
    clienteTelefono:
      overrides.clienteTelefono !== undefined
        ? (overrides.clienteTelefono ?? '')
        : defaults.clienteTelefono,
    equipoNombre: overrides.equipoNombre ?? defaults.equipoNombre,
    numeroSerie:
      overrides.numeroSerie !== undefined ? (overrides.numeroSerie ?? '') : defaults.numeroSerie,
    fechaActa: overrides.fechaActa
      ? overrides.fechaActa.toISOString().slice(0, 10)
      : defaults.fechaActa,
    lugar: overrides.lugar ?? defaults.lugar,
    montoAlquiler: overrides.montoAlquiler ?? defaults.montoAlquiler,
    periodoAlquiler: overrides.periodoAlquiler ?? defaults.periodoAlquiler,
    montoDepositoGarantia: overrides.montoDepositoGarantia ?? defaults.montoDepositoGarantia,
    observaciones:
      overrides.observaciones !== undefined
        ? (overrides.observaciones ?? '')
        : defaults.observaciones,
    facturaId:
      overrides.facturaId !== undefined
        ? (overrides.facturaId ?? '')
        : defaults.facturaId,
  }
}

function toDbData(values: ActaEntregaFormValues) {
  const fecha = new Date(values.fechaActa)
  fecha.setHours(12, 0, 0, 0)
  return {
    clienteNombre: values.clienteNombre.trim(),
    clienteDni: values.clienteDni.trim() || null,
    clienteDireccion: values.clienteDireccion.trim() || null,
    clienteTelefono: values.clienteTelefono.trim() || null,
    equipoNombre: values.equipoNombre.trim(),
    numeroSerie: values.numeroSerie.trim() || null,
    fechaActa: fecha,
    lugar: values.lugar.trim() || 'Formosa',
    montoAlquiler: values.montoAlquiler,
    periodoAlquiler: values.periodoAlquiler.trim(),
    montoDepositoGarantia: values.montoDepositoGarantia,
    observaciones: values.observaciones.trim() || null,
    facturaId: values.facturaId.trim() || null,
  }
}

async function validarFacturaOpcional(facturaId: string | null, contratoId: string) {
  if (!facturaId) return
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: { id: true, cuotasAlquiler: { select: { contratoId: true } } },
  })
  if (!factura) throw new ApiError(404, 'Factura no encontrada')
  const pertenece = factura.cuotasAlquiler.some((c) => c.contratoId === contratoId)
  if (!pertenece) {
    throw new ApiError(400, 'La factura no corresponde a este contrato de alquiler')
  }
}

export async function obtenerDefaultsActaEntrega(contratoId: string, lineaId: string, opts?: {
  periodo?: string
  facturaId?: string | null
}) {
  const { contrato, linea } = await cargarLineaContrato(contratoId, lineaId)
  return buildActaEntregaDefaults({
    clienteNombre: contrato.cliente.nombre,
    clienteTelefono: contrato.cliente.telefono,
    linea,
    periodo: opts?.periodo ?? formatPeriodo(new Date()),
    facturaId: opts?.facturaId,
  })
}

export async function crearActaEntregaAlquiler(
  contratoId: string,
  input: CreateInput,
  creadoPorId?: string,
) {
  const { contrato, linea } = await cargarLineaContrato(contratoId, input.lineaId)
  const defaults = buildActaEntregaDefaults({
    clienteNombre: contrato.cliente.nombre,
    clienteTelefono: contrato.cliente.telefono,
    linea,
    facturaId: input.facturaId,
  })
  const values = mergeConDefaults(defaults, input)
  await validarFacturaOpcional(values.facturaId || null, contratoId)

  const acta = await crearConNumeroUnico(
    siguienteNumeroActaAlquiler,
    (numero) =>
      prisma.actaEntregaAlquiler.create({
        data: {
          numero,
          contratoId,
          lineaId: input.lineaId,
          creadoPorId,
          ...toDbData(values),
        },
        include: actaInclude,
      }),
  )

  return acta
}

export async function actualizarActaEntregaAlquiler(actaId: string, input: UpdateInput) {
  const existente = await prisma.actaEntregaAlquiler.findUnique({
    where: { id: actaId },
    include: {
      contrato: {
        include: {
          cliente: { select: { nombre: true, telefono: true } },
        },
      },
      linea: {
        include: {
          inventarioUnidad: {
            select: {
              numeroSerie: true,
              inventario: { select: { nombre: true, marca: true, modelo: true } },
            },
          },
          equipo: { select: { nombre: true, numeroSerie: true } },
        },
      },
    },
  })
  if (!existente) throw new ApiError(404, 'ACTA no encontrada')

  const defaults: ActaEntregaFormValues = {
    clienteNombre: existente.clienteNombre,
    clienteDni: existente.clienteDni ?? '',
    clienteDireccion: existente.clienteDireccion ?? '',
    clienteTelefono: existente.clienteTelefono ?? '',
    equipoNombre: existente.equipoNombre,
    numeroSerie: existente.numeroSerie ?? '',
    fechaActa: existente.fechaActa.toISOString().slice(0, 10),
    lugar: existente.lugar,
    montoAlquiler: existente.montoAlquiler,
    periodoAlquiler: existente.periodoAlquiler,
    montoDepositoGarantia: existente.montoDepositoGarantia,
    observaciones: existente.observaciones ?? '',
    facturaId: existente.facturaId ?? '',
  }

  const values = mergeConDefaults(defaults, input)
  await validarFacturaOpcional(values.facturaId || null, existente.contratoId)

  return prisma.actaEntregaAlquiler.update({
    where: { id: actaId },
    data: toDbData(values),
    include: actaInclude,
  })
}

export async function obtenerActaEntregaAlquiler(actaId: string) {
  const acta = await prisma.actaEntregaAlquiler.findUnique({
    where: { id: actaId },
    include: actaInclude,
  })
  if (!acta) throw new ApiError(404, 'ACTA no encontrada')
  return acta
}

export async function listarActasEntregaContrato(contratoId: string) {
  const contrato = await prisma.contratoAlquiler.findUnique({
    where: { id: contratoId },
    select: { id: true },
  })
  if (!contrato) throw new ApiError(404, 'Contrato no encontrado')

  return prisma.actaEntregaAlquiler.findMany({
    where: { contratoId },
    include: actaInclude,
    orderBy: { creadoEn: 'desc' },
  })
}

export { actaInclude }
