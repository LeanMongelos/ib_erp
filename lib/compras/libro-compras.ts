import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface LineaLibroCompras {
  facturaCompraId: string
  numeroInterno: string
  fecha: Date
  proveedorRazonSocial: string
  proveedorCuit: string | null
  tipoComprobante: string
  puntoVenta: number
  numeroComprobante: number
  neto: number
  iva: number
  total: number
  moneda: string
  cae: string | null
  constatacionResultado: string | null
}

export interface FiltroLibroCompras {
  desde: Date
  hasta: Date
  proveedorId?: string
}

export async function consultarLibroCompras(filtro: FiltroLibroCompras): Promise<LineaLibroCompras[]> {
  const where: Prisma.FacturaCompraWhereInput = {
    estado: 'REGISTRADA',
    fecha: { gte: filtro.desde, lte: filtro.hasta },
    ...(filtro.proveedorId && { proveedorId: filtro.proveedorId }),
  }

  const facturas = await prisma.facturaCompra.findMany({
    where,
    orderBy: [{ fecha: 'asc' }, { numero: 'asc' }],
    include: {
      proveedor: { select: { razonSocial: true, cuit: true } },
      tipoComprobanteAfip: { select: { codigoAfip: true, letra: true, descripcion: true } },
    },
  })

  return facturas.map((fc) => ({
    facturaCompraId: fc.id,
    numeroInterno: fc.numero,
    fecha: fc.fecha,
    proveedorRazonSocial: fc.proveedor.razonSocial,
    proveedorCuit: fc.proveedor.cuit,
    tipoComprobante: fc.tipoComprobanteAfip
      ? `${fc.tipoComprobanteAfip.codigoAfip} ${fc.tipoComprobanteAfip.letra} — ${fc.tipoComprobanteAfip.descripcion}`
      : `PV ${fc.puntoVenta}`,
    puntoVenta: fc.puntoVenta,
    numeroComprobante: fc.numeroComprobante,
    neto: fc.neto,
    iva: fc.iva,
    total: fc.total,
    moneda: fc.moneda,
    cae: fc.cae,
    constatacionResultado: fc.constatacionResultado,
  }))
}

export function libroComprasACsv(lineas: LineaLibroCompras[]): string {
  const header = [
    'Fecha',
    'Proveedor',
    'CUIT',
    'Tipo comprobante',
    'Punto venta',
    'Número comprobante',
    'Neto',
    'IVA',
    'Total',
    'Moneda',
    'CAE',
    'Constatación',
    'Número interno',
  ].join(';')

  const rows = lineas.map((l) => [
    l.fecha.toISOString().slice(0, 10),
    escCsv(l.proveedorRazonSocial),
    l.proveedorCuit ?? '',
    escCsv(l.tipoComprobante),
    String(l.puntoVenta),
    String(l.numeroComprobante),
    l.neto.toFixed(2),
    l.iva.toFixed(2),
    l.total.toFixed(2),
    l.moneda,
    l.cae ?? '',
    l.constatacionResultado ?? '',
    l.numeroInterno,
  ].join(';'))

  return [header, ...rows].join('\n')
}

function escCsv(s: string): string {
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function totalesLibroCompras(lineas: LineaLibroCompras[]) {
  const neto = lineas.reduce((a, l) => a + l.neto, 0)
  const iva = lineas.reduce((a, l) => a + l.iva, 0)
  const total = lineas.reduce((a, l) => a + l.total, 0)
  return {
    neto: Math.round(neto * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    total: Math.round(total * 100) / 100,
    cantidad: lineas.length,
  }
}
