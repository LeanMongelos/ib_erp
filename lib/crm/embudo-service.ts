import type { EtapaEmbudo, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { EmbudoStats } from '@/lib/crm/embudo-utils'
import { extractMontoFromDatos, extractProximaAccionFecha, getTransitionForm, validateForm } from '@/lib/crm/embudo-forms'
import type { EtapaKey } from '@/lib/crm/embudo-constants'
import { validarMovimientoEmbudoCliente } from '@/lib/crm/embudo-movimiento-client'
import { ApiError } from '@/lib/api-auth'
import { crearPresupuestoDesdePropuesta } from '@/lib/crm/embudo-presupuesto'
import {
  aprobarPresupuestoNegocioGanado,
  vincularFacturaNegocioCierre,
} from '@/lib/crm/embudo-sincronizar-presupuesto'

export async function listarNegociosEmbudo() {
  return prisma.negocioEmbudo.findMany({
    where: { activo: true },
    orderBy: [{ etapa: 'asc' }, { numero: 'desc' }],
    include: { presupuesto: { select: { id: true, numero: true } } },
  })
}

export function calcularStatsDb(negocios: { etapa: EtapaEmbudo; monto: number; cerradoEn: Date | null }[]): EmbudoStats {
  const activos = negocios.filter((n) => n.etapa !== 'CIERRE' && n.etapa !== 'PERDIDO')
  const pipelineArs = activos.reduce((s, n) => s + n.monto, 0)
  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const cerradosMes = negocios.filter(
    (n) => n.etapa === 'CIERRE' && n.cerradoEn && n.cerradoEn >= inicioMes,
  ).length
  return {
    totalActivos: activos.length,
    pipelineArs,
    cerradosMes,
    ticketPromedio: activos.length > 0 ? pipelineArs / activos.length : 0,
  }
}

export function validarMovimiento(desde: EtapaEmbudo, hasta: EtapaEmbudo, retroceso?: boolean) {
  const err = validarMovimientoEmbudoCliente(desde as EtapaKey, hasta as EtapaKey, retroceso)
  if (err) throw new ApiError(400, err)
}

export async function moverNegocioEmbudo(opts: {
  id: string
  etapaHasta: EtapaEmbudo
  retroceso?: boolean
  datos?: Record<string, unknown>
  usuarioId?: string
}) {
  const negocio = await prisma.negocioEmbudo.findUnique({ where: { id: opts.id } })
  if (!negocio) throw new ApiError(404, 'Negocio no encontrado')

  const desde = negocio.etapa
  const hasta = opts.etapaHasta
  validarMovimiento(desde, hasta, opts.retroceso)

  const form = getTransitionForm(desde as EtapaKey, hasta as EtapaKey, !!opts.retroceso)
  const datos = (opts.datos ?? {}) as Record<string, unknown>
  const fields = form?.fields ?? []

  if (fields.length > 0) {
    const errForm = validateForm(fields, datos)
    if (errForm) throw new ApiError(400, errForm)
  }

  let monto = negocio.monto
  const nuevoMonto = extractMontoFromDatos(fields, datos)
  if (nuevoMonto !== null) monto = nuevoMonto

  let presupuestoId = negocio.presupuestoId
  let clienteId = negocio.clienteId

  if (desde === 'DOCUMENTACION' && hasta === 'PROPUESTA' && !opts.retroceso && !presupuestoId) {
    const creado = await crearPresupuestoDesdePropuesta(negocio, datos, opts.usuarioId)
    presupuestoId = creado.id
    clienteId = creado.clienteId
    datos.numeroPropuesta = creado.numero
    datos.presupuestoCreadoAutomatico = true
  } else {
    const numeroPropuesta = datos.numeroPropuesta
    if (typeof numeroPropuesta === 'string' && numeroPropuesta.trim() && !presupuestoId) {
      const pres = await prisma.presupuesto.findUnique({ where: { numero: numeroPropuesta.trim() } })
      if (pres) presupuestoId = pres.id
    }
  }

  const proxima = extractProximaAccionFecha(fields, datos)
  let mergedDatos = { ...(negocio.datos as object), ...datos } as Prisma.InputJsonValue

  if (desde === 'ANALISIS' && hasta === 'ENTREGA' && !opts.retroceso && presupuestoId) {
    const montoFinal = Number(datos.montoFinal)
    await aprobarPresupuestoNegocioGanado(
      presupuestoId,
      Number.isFinite(montoFinal) && montoFinal > 0 ? montoFinal : monto,
    )
  }

  if (desde === 'ENTREGA' && hasta === 'CIERRE' && !opts.retroceso) {
    const facturaId = typeof datos.facturaId === 'string' ? datos.facturaId : null
    const numeroFactura = typeof datos.numeroFactura === 'string' ? datos.numeroFactura : null
    if (facturaId || numeroFactura?.trim()) {
      const vinculo = await vincularFacturaNegocioCierre({
        presupuestoId,
        clienteId,
        facturaId,
        numeroFactura,
      })
      mergedDatos = {
        ...(mergedDatos as object),
        facturaId: vinculo.facturaId,
        numeroFactura: vinculo.numero,
      } as Prisma.InputJsonValue
      datos.numeroFactura = vinculo.numero
    }
  }

  const cerradoEn = hasta === 'CIERRE' || hasta === 'PERDIDO' ? new Date() : negocio.cerradoEn

  const [actualizado] = await prisma.$transaction([
    prisma.negocioEmbudo.update({
      where: { id: opts.id },
      data: {
        etapa: hasta,
        etapaDesde: new Date(),
        monto,
        presupuestoId,
        clienteId,
        proximaAccionFecha: proxima,
        datos: mergedDatos,
        cerradoEn,
      },
    }),
    prisma.historialEmbudo.create({
      data: {
        negocioId: opts.id,
        tipo: 'MOVIMIENTO',
        etapaDesde: desde,
        etapaHasta: hasta,
        retroceso: !!opts.retroceso,
        datos: datos as Prisma.InputJsonValue,
        notas: typeof datos.descripcionRetroceso === 'string' ? datos.descripcionRetroceso : null,
        usuarioId: opts.usuarioId,
      },
    }),
  ])

  return actualizado
}

export async function reactivarNegocioEmbudo(id: string, usuarioId: string) {
  const negocio = await prisma.negocioEmbudo.findUnique({ where: { id } })
  if (!negocio) throw new ApiError(404, 'Negocio no encontrado')
  if (negocio.activo) throw new ApiError(400, 'El negocio ya está activo en el pipeline')

  const etapaRestaurada: EtapaEmbudo =
    negocio.etapa === 'CIERRE' || negocio.etapa === 'PERDIDO' ? 'SEGUIMIENTO' : negocio.etapa

  const [actualizado] = await prisma.$transaction([
    prisma.negocioEmbudo.update({
      where: { id },
      data: {
        activo: true,
        etapa: etapaRestaurada,
        etapaDesde: new Date(),
        cerradoEn: null,
      },
    }),
    prisma.historialEmbudo.create({
      data: {
        negocioId: id,
        tipo: 'REACTIVACION',
        etapaDesde: negocio.etapa,
        etapaHasta: etapaRestaurada,
        datos: { etapaAnterior: negocio.etapa },
        usuarioId,
      },
    }),
  ])

  return actualizado
}
