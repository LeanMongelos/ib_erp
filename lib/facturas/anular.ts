/**
 * Anulación de facturas: borrador sin CAE o nota de crédito AFIP + vencimientos.
 */
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { anularVencimientosPendientes } from '@/lib/cobranzas/vencimientos'
import { crearConNumeroUnico, siguienteNumeroNotaCredito } from '@/lib/sequences'
import { procesarEmisionNotaCredito } from '@/lib/afip/emitir-nota-credito'
import { registrarAuditoria } from '@/lib/audit'

const ESTADOS_ANULABLES_SIN_NC = ['BORRADOR', 'PENDIENTE', 'RECHAZADA'] as const
const ESTADOS_ANULABLES_CON_NC = ['EMITIDA', 'VENCIDA'] as const

export type FacturaAnulacionInput = {
  id: string
  numero: string
  estado: string
  cae: string | null
  pagos: { monto: number }[]
}

export function validarPreAnulacionFactura(
  factura: FacturaAnulacionInput,
  opts: { chequesEnCartera: number; yaTieneNc: boolean },
): { requiereNc: boolean } {
  if (factura.estado === 'ANULADA') {
    throw new ApiError(400, 'La factura ya está anulada')
  }
  if (factura.estado === 'PENDIENTE_CAE') {
    throw new ApiError(400, 'La factura está pendiente de CAE. Esperá el resultado de AFIP antes de anular.')
  }
  if (factura.estado === 'PAGADA') {
    throw new ApiError(400, 'La factura está pagada. Revertí las cobranzas antes de anular.')
  }
  if (opts.yaTieneNc) {
    throw new ApiError(400, 'La factura ya tiene una nota de crédito emitida')
  }
  if (factura.pagos.length > 0) {
    throw new ApiError(400, 'La factura tiene cobranzas imputadas. Revertí los pagos antes de anular.')
  }
  if (opts.chequesEnCartera > 0) {
    throw new ApiError(
      400,
      'Hay cheques en cartera vinculados a esta factura. Depositá, rechazá o anulá los cheques antes de anular.',
    )
  }

  const requiereNc =
    !!factura.cae &&
    (ESTADOS_ANULABLES_CON_NC as readonly string[]).includes(factura.estado)

  const anulable =
    (ESTADOS_ANULABLES_SIN_NC as readonly string[]).includes(factura.estado) ||
    requiereNc ||
    (!factura.cae && (ESTADOS_ANULABLES_CON_NC as readonly string[]).includes(factura.estado))

  if (!anulable) {
    throw new ApiError(400, `No se puede anular una factura en estado ${factura.estado}`)
  }

  return { requiereNc }
}

async function resolverPlantillaNotaCredito(fallbackId: string | null): Promise<string | null> {
  const nc = await prisma.plantillaImpresion.findFirst({
    where: { tipo: 'NOTA_CREDITO', predeterminado: true, activo: true },
    select: { id: true },
  })
  return nc?.id ?? fallbackId
}

export async function procesarAnulacionFactura(facturaId: string, usuarioId?: string) {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: {
      items: true,
      emisor: true,
      pagos: true,
      notasCredito: {
        where: { estado: { in: ['EMITIDA', 'PENDIENTE_CAE', 'BORRADOR'] } },
      },
    },
  })
  if (!factura) throw new ApiError(404, 'Factura no encontrada')

  const chequesEnCartera = await prisma.chequeCobranza.count({
    where: {
      estado: 'EN_CARTERA',
      pago: { imputaciones: { some: { facturaId } } },
    },
  })

  const { requiereNc } = validarPreAnulacionFactura(factura, {
    chequesEnCartera,
    yaTieneNc: factura.notasCredito.length > 0,
  })

  if (!requiereNc) {
    const actualizada = await prisma.$transaction(async (tx) => {
      await anularVencimientosPendientes(facturaId, tx)
      return tx.factura.update({
        where: { id: facturaId },
        data: { estado: 'ANULADA', fechaPago: null },
        include: { cliente: true, items: true, emisor: true },
      })
    })

    await registrarAuditoria({
      usuarioId,
      accion: 'factura.anular',
      entidad: 'Factura',
      entidadId: facturaId,
      despues: { estado: 'ANULADA', notaCredito: false },
    })

    return { ok: true as const, factura: actualizada, notaCredito: null, simulado: false }
  }

  const plantillaId = await resolverPlantillaNotaCredito(factura.plantillaId)
  const motivo = `Anulación de ${factura.numero}`

  const notaCredito = await crearConNumeroUnico(
    () => siguienteNumeroNotaCredito(factura.tipo),
    (numero) =>
      prisma.factura.create({
        data: {
          numero,
          tipo: factura.tipo,
          estado: 'PENDIENTE_CAE',
          subtotal: factura.subtotal,
          iva: factura.iva,
          total: factura.total,
          moneda: factura.moneda,
          cotizacionUsd: factura.cotizacionUsd,
          bonificacionPct: factura.bonificacionPct,
          alicuotaIvaPct: factura.alicuotaIvaPct,
          clienteId: factura.clienteId,
          emisorId: factura.emisorId,
          plantillaId,
          puntoVenta: factura.puntoVenta ?? factura.emisor?.puntoVenta,
          concepto: factura.concepto,
          condicionPago: null,
          observaciones: motivo,
          facturaOrigenId: facturaId,
          items: {
            create: factura.items.map((i) => ({
              codigo: i.codigo,
              descripcion: i.descripcion,
              descripcionLarga: i.descripcionLarga,
              fotoUrl: i.fotoUrl,
              cantidad: i.cantidad,
              precioUnit: i.precioUnit,
              bonificacionPct: i.bonificacionPct,
              alicuotaIvaPct: i.alicuotaIvaPct,
              subtotal: i.subtotal,
            })),
          },
        },
        include: { cliente: true, items: true, emisor: true },
      }),
  )

  const emision = await procesarEmisionNotaCredito(notaCredito.id, facturaId, usuarioId)
  if (!emision.ok) {
    throw new ApiError(422, emision.observaciones ?? 'AFIP rechazó la nota de crédito')
  }

  const resultado = await prisma.$transaction(async (tx) => {
    await anularVencimientosPendientes(facturaId, tx)
    const anulada = await tx.factura.update({
      where: { id: facturaId },
      data: { estado: 'ANULADA', fechaPago: null },
      include: { cliente: true, items: true, emisor: true },
    })
    return anulada
  })

  await registrarAuditoria({
    usuarioId,
    accion: 'factura.anular',
    entidad: 'Factura',
    entidadId: facturaId,
    despues: { estado: 'ANULADA', notaCreditoId: notaCredito.id },
  })

  return {
    ok: true as const,
    factura: resultado,
    notaCredito: emision.factura,
    simulado: emision.simulado ?? false,
  }
}
