/**
 * Mapeo de entidades Prisma → DatosDocumentoRender para PDF.
 * Server-only.
 */

import type { PlantillaConfig } from './types'
import type { DatosDocumentoRender } from './types'
import { PLANTILLA_FACTURA_DEFAULT, PLANTILLA_PRESUPUESTO_DEFAULT } from './defaults'
import { prisma } from '@/lib/prisma'
import { parsePlazosCobranza } from '@/lib/cobranzas/plazos'
import { calcularInteresFinanciacion } from '@/lib/cobranzas/financiacion'

type EmisorRow = {
  razonSocial: string
  cuit: string
  condicionIva: string
  ingresosBrutos?: string | null
  inicioActividades?: Date | null
  domicilio?: string | null
  telefono?: string | null
  email?: string | null
}

type ClienteRow = {
  nombre: string
  direccion?: string | null
  cuit?: string | null
  condicionIva?: string | null
  condicionPago?: string | null
}

type ItemRow = {
  codigo?: string | null
  descripcion: string
  descripcionLarga?: string | null
  fotoUrl?: string | null
  cantidad: number
  precioUnit: number
  bonificacionPct?: number
  subtotal: number
  numeroSerie?: string | null
  proximoPreventivo?: Date | string | null
}

export async function getPlantillaConfig(
  plantillaId: string | null | undefined,
  tipo: 'FACTURA' | 'PRESUPUESTO',
): Promise<PlantillaConfig> {
  if (plantillaId) {
    const p = await prisma.plantillaImpresion.findUnique({ where: { id: plantillaId } })
    if (p?.activo) return p.config as unknown as PlantillaConfig
  }
  const def = await prisma.plantillaImpresion.findFirst({
    where: { tipo, predeterminado: true, activo: true },
  })
  if (def) return def.config as unknown as PlantillaConfig
  return tipo === 'PRESUPUESTO' ? PLANTILLA_PRESUPUESTO_DEFAULT : PLANTILLA_FACTURA_DEFAULT
}

function mapEmisor(e: EmisorRow) {
  return {
    razonSocial: e.razonSocial,
    cuit: e.cuit,
    condicionIva: e.condicionIva,
    ingresosBrutos: e.ingresosBrutos,
    inicioActividades: e.inicioActividades?.toISOString() ?? null,
    domicilio: e.domicilio,
    telefono: e.telefono,
    email: e.email,
  }
}

function mapCliente(c: ClienteRow) {
  return {
    nombre: c.nombre,
    direccion: c.direccion,
    cuit: c.cuit,
    condicionIva: c.condicionIva,
    condicionPago: c.condicionPago,
  }
}

function extrasEquipoItem(i: ItemRow): string | null {
  const partes: string[] = []
  if (i.numeroSerie?.trim()) partes.push(`N° serie: ${i.numeroSerie.trim()}`)
  if (i.proximoPreventivo) {
    const f = i.proximoPreventivo instanceof Date ? i.proximoPreventivo : new Date(i.proximoPreventivo)
    if (!Number.isNaN(f.getTime())) partes.push(`Próx. preventivo: ${f.toISOString().slice(0, 10)}`)
  }
  return partes.length ? partes.join(' · ') : null
}

function mapItems(items: ItemRow[]) {
  return items.map((i) => {
    const extras = extrasEquipoItem(i)
    const largaBase = i.descripcionLarga?.trim()
    const descripcionLarga = [largaBase, extras].filter(Boolean).join('\n') || null
    return {
      codigo: i.codigo,
      descripcion: i.descripcion,
      descripcionLarga,
      fotoUrl: i.fotoUrl,
      cantidad: i.cantidad,
      precioUnit: Number(i.precioUnit),
      bonificacionPct: i.bonificacionPct ?? 0,
      subtotal: Number(i.subtotal),
    }
  })
}

export function buildDatosPresupuesto(
  pres: {
    numero: string
    fechaEmision: Date
    subtotal: number
    iva: number
    total: number
    bonificacionPct?: number
    observaciones?: string | null
    condicionPago?: string | null
    formaPago?: string | null
    plazoEntrega?: string | null
    garantia?: string | null
    vigenciaDias?: number
    tasaFinanciacionPct?: number
    interesFinanciacion?: number
    moneda?: string
    cotizacionUsd?: number | null
    items: ItemRow[]
  },
  emisor: EmisorRow,
  cliente: ClienteRow,
): DatosDocumentoRender {
  return {
    tipo: 'PRESUPUESTO',
    numero: pres.numero,
    fechaEmision: pres.fechaEmision.toISOString(),
    emisor: mapEmisor(emisor),
    cliente: mapCliente(cliente),
    items: mapItems(pres.items),
    subtotal: Number(pres.subtotal),
    iva: Number(pres.iva),
    total: Number(pres.total),
    bonificacionPct: pres.bonificacionPct ?? 0,
    observaciones: pres.observaciones,
    condicionPago: pres.condicionPago,
    formaPago: pres.formaPago,
    plazoEntrega: pres.plazoEntrega,
    garantia: pres.garantia,
    vigenciaDias: pres.vigenciaDias,
    tasaFinanciacionPct: pres.tasaFinanciacionPct ?? 0,
    interesFinanciacion: pres.interesFinanciacion ?? 0,
    moneda: pres.moneda ?? 'ARS',
    cotizacionUsd: pres.cotizacionUsd ?? null,
  }
}

export function buildDatosFactura(
  fact: {
    numero: string
    tipo: 'A' | 'B' | 'C'
    estado: string
    fechaEmision: Date
    subtotal: number
    iva: number
    total: number
    bonificacionPct?: number
    observaciones?: string | null
    condicionPago?: string | null
    cae?: string | null
    caeVencimiento?: Date | null
    moneda?: string
    cotizacionUsd?: number | null
    items: ItemRow[]
  },
  emisor: EmisorRow,
  cliente: ClienteRow,
  opts?: {
    qrDataUrl?: string | null
    presupuesto?: {
      numero: string
      formaPago?: string | null
      plazoEntrega?: string | null
      garantia?: string | null
      tasaFinanciacionPct?: number
      interesFinanciacion?: number
    } | null
  },
): DatosDocumentoRender {
  const fiscal = fact.estado === 'EMITIDA'
  const pres = opts?.presupuesto
  const bonifPct = fact.bonificacionPct ?? 0
  const bonifImporte = Number(fact.subtotal) * bonifPct / 100
  const totalNeto = Number(fact.subtotal) - bonifImporte + Number(fact.iva)
  const plazos = parsePlazosCobranza(fact.condicionPago)
  const tasa = pres?.tasaFinanciacionPct ?? 0
  const interes = calcularInteresFinanciacion(totalNeto, plazos, tasa)

  return {
    tipo: 'FACTURA',
    numero: fact.numero,
    tipoFactura: fact.tipo,
    fechaEmision: fact.fechaEmision.toISOString(),
    emisor: mapEmisor(emisor),
    cliente: mapCliente(cliente),
    items: mapItems(fact.items),
    subtotal: Number(fact.subtotal),
    iva: Number(fact.iva),
    total: totalNeto + interes,
    bonificacionPct: fact.bonificacionPct ?? 0,
    observaciones: fact.observaciones,
    condicionPago: fact.condicionPago,
    formaPago: pres?.formaPago ?? undefined,
    plazoEntrega: pres?.plazoEntrega ?? undefined,
    garantia: pres?.garantia ?? undefined,
    tasaFinanciacionPct: tasa,
    interesFinanciacion: interes,
    presupuestoNumero: pres?.numero ?? null,
    cae: fiscal ? fact.cae : null,
    caeVencimiento: fiscal && fact.caeVencimiento ? fact.caeVencimiento.toISOString() : null,
    qrDataUrl: fiscal ? opts?.qrDataUrl : null,
    moneda: fact.moneda ?? 'ARS',
    cotizacionUsd: fact.cotizacionUsd ?? null,
  }
}
