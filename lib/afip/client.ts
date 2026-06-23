/**
 * lib/afip/client.ts
 * Cliente AFIP vía @afipsdk/afip.js.
 *
 * Modo simulación: si el emisor no tiene certificados cargados, genera un CAE
 * ficticio para homologación/demos (nunca usar en producción sin cert real).
 */

import Afip from '@afipsdk/afip.js'
import { prisma } from '@/lib/prisma'
import { getStorage } from '@/lib/storage'
import { afipMonedaId } from '@/lib/moneda'

export interface ResultadoCAE {
  ok: boolean
  cae?: string
  caeVencimiento?: Date
  numeroAfip?: number
  observaciones?: string
  simulado?: boolean
}

function cuitNumerico(cuit: string): number {
  return parseInt(cuit.replace(/\D/g, ''), 10)
}

function tipoComprobanteAfip(tipo: string): number {
  // WSFEv1: 1=Factura A, 6=Factura B, 11=Factura C
  const map: Record<string, number> = { A: 1, B: 6, C: 11 }
  return map[tipo] ?? 6
}

/** Genera CAE simulado para desarrollo/homologación sin certificado. */
function caeSimulado(facturaId: string, ptoVta: number): ResultadoCAE {
  const hash = facturaId.slice(-8).toUpperCase()
  const cae = `7${Date.now().toString().slice(-13)}${hash.slice(0, 2)}`.slice(0, 14)
  const venc = new Date()
  venc.setDate(venc.getDate() + 10)
  return {
    ok: true,
    cae,
    caeVencimiento: venc,
    numeroAfip: ptoVta * 100000 + Math.floor(Math.random() * 90000) + 10000,
    simulado: true,
  }
}

export async function emitirCAEFactura(facturaId: string): Promise<ResultadoCAE> {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { emisor: true, cliente: true },
  })
  if (!factura) return { ok: false, observaciones: 'Factura no encontrada' }
  if (!factura.emisor) return { ok: false, observaciones: 'La factura no tiene emisor asignado' }

  const emisor = factura.emisor
  const ptoVta = factura.puntoVenta ?? emisor.puntoVenta

  // Sin certificados → simulación solo en homologación (nunca en producción fiscal)
  if (!emisor.certificadoPath || !emisor.clavePrivadaPath) {
    if (emisor.ambiente === 'PRODUCCION') {
      return {
        ok: false,
        observaciones: 'El emisor no tiene certificado AFIP configurado. Cargá certificado y clave privada antes de emitir en producción.',
      }
    }
    console.warn('[afip] Sin certificado; emitiendo CAE simulado para', factura.numero)
    return caeSimulado(facturaId, ptoVta)
  }

  try {
    const storage = getStorage()
    const cert = await storage.get(emisor.certificadoPath)
    const key = await storage.get(emisor.clavePrivadaPath)

    const afip = new Afip({
      CUIT: cuitNumerico(emisor.cuit),
      cert: cert.toString('utf8'),
      key: key.toString('utf8'),
      production: emisor.ambiente === 'PRODUCCION',
      access_token: process.env.AFIP_ACCESS_TOKEN ?? '',
    } as ConstructorParameters<typeof Afip>[0])

    const tipoCbte = tipoComprobanteAfip(factura.tipo)
    const ultimo = await afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte)
    const numeroAfip = (ultimo ?? 0) + 1

    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const docTipo = factura.cliente.cuit ? 80 : 99 // CUIT vs consumidor final
    const docNro = factura.cliente.cuit
      ? parseInt(factura.cliente.cuit.replace(/\D/g, ''), 10)
      : 0

    const monId = afipMonedaId(factura.moneda)
    const monCotiz = factura.moneda === 'USD' ? (factura.cotizacionUsd ?? 1) : 1

    const data = {
      CantReg: 1,
      PtoVta: ptoVta,
      CbteTipo: tipoCbte,
      Concepto: factura.concepto,
      DocTipo: docTipo,
      DocNro: docNro,
      CbteDesde: numeroAfip,
      CbteHasta: numeroAfip,
      CbteFch: fecha,
      ImpTotal: Number(factura.total),
      ImpTotConc: 0,
      ImpNeto: Number(factura.subtotal),
      ImpOpEx: 0,
      ImpIVA: Number(factura.iva),
      ImpTrib: 0,
      MonId: monId,
      MonCotiz: monCotiz,
      Iva: [{ Id: 5, BaseImp: Number(factura.subtotal), Importe: Number(factura.iva) }],
    }

    const res = await afip.ElectronicBilling.createVoucher(data)
    if (res?.CAE) {
      const vencStr = String(res.CAEFchVto ?? '')
      const venc = vencStr.length === 8
        ? new Date(`${vencStr.slice(0, 4)}-${vencStr.slice(4, 6)}-${vencStr.slice(6, 8)}`)
        : new Date(Date.now() + 10 * 86400000)
      return { ok: true, cae: res.CAE, caeVencimiento: venc, numeroAfip }
    }
    return { ok: false, observaciones: JSON.stringify(res?.Errors ?? res) }
  } catch (e: any) {
    console.error('[afip] error emitiendo CAE:', e.message)
    return { ok: false, observaciones: e.message ?? 'No se pudo emitir el comprobante en AFIP' }
  }
}

/** Arma el JSON del QR fiscal AFIP (RG 4892). */
export function buildQrFiscal(params: {
  fecha: Date
  cuit: string
  ptoVta: number
  tipoCmp: number
  nroCmp: number
  importe: number
  moneda?: string
  ctz?: number
  tipoDocRec: number
  nroDocRec: number
  tipoCodAut: string
  codAut: string
}): string {
  const payload = {
    ver: 1,
    fecha: params.fecha.toISOString().slice(0, 10),
    cuit: cuitNumerico(params.cuit),
    ptoVta: params.ptoVta,
    tipoCmp: params.tipoCmp,
    nroCmp: params.nroCmp,
    importe: params.importe,
    moneda: params.moneda ?? 'PES',
    ctz: params.ctz ?? 1,
    tipoDocRec: params.tipoDocRec,
    nroDocRec: params.nroDocRec,
    tipoCodAut: params.tipoCodAut,
    codAut: params.codAut,
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}
