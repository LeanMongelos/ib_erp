/**
 * lib/afip/emitir.ts
 * Orquesta la emisión fiscal de una factura (CAE + QR + cambio de estado).
 */

import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { emitirCAEFactura, buildQrFiscal } from './client'
import { validarEmisionAfip } from './validar-emision'
import { afipMonedaId } from '@/lib/moneda'
import { registrarAuditoria } from '@/lib/audit'

const TIPO_CMP: Record<string, number> = { A: 1, B: 6, C: 11 }

export async function procesarEmisionFactura(facturaId: string, usuarioId?: string) {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { emisor: true, cliente: true },
  })
  if (!factura) throw new Error('Factura no encontrada')
  if (!['BORRADOR', 'PENDIENTE', 'PENDIENTE_CAE', 'RECHAZADA'].includes(factura.estado)) {
    throw new Error(`Estado ${factura.estado} no permite emisión`)
  }

  const bloqueoProd = validarEmisionAfip(factura.emisor)
  if (bloqueoProd) {
    return { ok: false, observaciones: bloqueoProd }
  }

  await prisma.factura.update({
    where: { id: facturaId },
    data: { estado: 'PENDIENTE_CAE' },
  })

  const resultado = await emitirCAEFactura(facturaId)

  if (!resultado.ok) {
    await prisma.factura.update({
      where: { id: facturaId },
      data: { estado: 'RECHAZADA', afipObservaciones: resultado.observaciones ?? 'Rechazada' },
    })
    return { ok: false, observaciones: resultado.observaciones }
  }

  const emisor = factura.emisor!
  const ptoVta = factura.puntoVenta ?? emisor.puntoVenta
  const numeroAfip = resultado.numeroAfip ?? factura.numeroAfip ?? 1
  const qrJson = buildQrFiscal({
    fecha: factura.fechaEmision,
    cuit: emisor.cuit,
    ptoVta,
    tipoCmp: TIPO_CMP[factura.tipo] ?? 6,
    nroCmp: numeroAfip,
    importe: Number(factura.total),
    moneda: afipMonedaId(factura.moneda),
    ctz: factura.moneda === 'USD' ? (factura.cotizacionUsd ?? 1) : 1,
    tipoDocRec: factura.cliente.cuit ? 80 : 99,
    nroDocRec: factura.cliente.cuit
      ? parseInt(factura.cliente.cuit.replace(/\D/g, ''), 10)
      : 0,
    tipoCodAut: 'E',
    codAut: resultado.cae!,
  })

  let qrDataUrl: string | null = null
  try {
    qrDataUrl = await QRCode.toDataURL(qrJson, { width: 200, margin: 1 })
  } catch { /* QR opcional en preview */ }

  const updated = await prisma.factura.update({
    where: { id: facturaId },
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
    accion: 'factura.emit_afip',
    entidad: 'Factura',
    entidadId: facturaId,
    despues: { cae: resultado.cae, numeroAfip, simulado: resultado.simulado },
  })

  const { provisionarEquiposDesdeFactura } = await import('@/lib/equipos/provisionar-venta')
  const provision = await provisionarEquiposDesdeFactura(facturaId, usuarioId)
  if (provision.errores.length) {
    await prisma.factura.update({
      where: { id: facturaId },
      data: {
        observaciones: [
          updated.observaciones,
          `[Entrega equipos] ${provision.errores.join('; ')}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    })
  }

  return { ok: true, factura: updated, qrDataUrl, simulado: resultado.simulado, provision }
}
