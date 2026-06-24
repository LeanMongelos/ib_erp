/**
 * Emisión fiscal de nota de crédito (CAE + QR).
 */
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { emitirCAENotaCredito, buildQrFiscal, tipoNotaCreditoAfip } from './client'
import { validarEmisionAfip } from './validar-emision'
import { afipMonedaId } from '@/lib/moneda'
import { registrarAuditoria } from '@/lib/audit'
import { notifyAfipFalloEmision } from '@/lib/afip/notify-fallo-emision'

export async function procesarEmisionNotaCredito(
  notaCreditoId: string,
  facturaOrigenId: string,
  usuarioId?: string,
) {
  const nota = await prisma.factura.findUnique({
    where: { id: notaCreditoId },
    include: { emisor: true, cliente: true },
  })
  if (!nota) throw new Error('Nota de crédito no encontrada')
  if (nota.estado !== 'PENDIENTE_CAE') {
    throw new Error(`Estado ${nota.estado} no permite emisión de nota de crédito`)
  }

  const bloqueoProd = validarEmisionAfip(nota.emisor)
  if (bloqueoProd) {
    return { ok: false, observaciones: bloqueoProd }
  }

  const resultado = await emitirCAENotaCredito(notaCreditoId, facturaOrigenId)

  if (!resultado.ok) {
    const obs = resultado.observaciones ?? 'Rechazada'
    await prisma.factura.update({
      where: { id: notaCreditoId },
      data: { estado: 'RECHAZADA', afipObservaciones: obs },
    })
    void notifyAfipFalloEmision({
      facturaId: notaCreditoId,
      observaciones: obs,
      usuarioId,
      origenFallo: 'emision',
    })
    return { ok: false, observaciones: resultado.observaciones }
  }

  const emisor = nota.emisor!
  const ptoVta = nota.puntoVenta ?? emisor.puntoVenta
  const numeroAfip = resultado.numeroAfip ?? nota.numeroAfip ?? 1
  const tipoCmp = tipoNotaCreditoAfip(nota.tipo)

  const qrJson = buildQrFiscal({
    fecha: nota.fechaEmision,
    cuit: emisor.cuit,
    ptoVta,
    tipoCmp,
    nroCmp: numeroAfip,
    importe: Number(nota.total),
    moneda: afipMonedaId(nota.moneda),
    ctz: nota.moneda === 'USD' ? (nota.cotizacionUsd ?? 1) : 1,
    tipoDocRec: nota.cliente.cuit ? 80 : 99,
    nroDocRec: nota.cliente.cuit
      ? parseInt(nota.cliente.cuit.replace(/\D/g, ''), 10)
      : 0,
    tipoCodAut: 'E',
    codAut: resultado.cae!,
  })

  let qrDataUrl: string | null = null
  try {
    qrDataUrl = await QRCode.toDataURL(qrJson, { width: 200, margin: 1 })
  } catch { /* QR opcional */ }

  const updated = await prisma.factura.update({
    where: { id: notaCreditoId },
    data: {
      estado: 'EMITIDA',
      cae: resultado.cae,
      caeVencimiento: resultado.caeVencimiento,
      numeroAfip,
      puntoVenta: ptoVta,
      qrData: qrJson,
      afipObservaciones: resultado.simulado ? 'CAE SIMULADO (sin certificado AFIP)' : null,
    },
    include: { cliente: true, items: true, emisor: true },
  })

  await registrarAuditoria({
    usuarioId,
    accion: 'factura.emit_nc_afip',
    entidad: 'Factura',
    entidadId: notaCreditoId,
    despues: { cae: resultado.cae, numeroAfip, facturaOrigenId, simulado: resultado.simulado },
  })

  return { ok: true, factura: updated, qrDataUrl, simulado: resultado.simulado }
}
