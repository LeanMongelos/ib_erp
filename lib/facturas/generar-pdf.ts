/**
 * Generación de PDF de factura (servidor) — mismo pipeline que GET /api/facturas/[id]/pdf.
 */

import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { renderDocumentoPDF } from '@/lib/plantillas/render-documento'
import { getPlantillaResuelta, buildDatosFactura } from '@/lib/plantillas/build-datos'
import { resolverFotosItemsPdf } from '@/lib/inventario/resolve-foto-pdf.server'

export async function generarPdfFactura(facturaId: string): Promise<Buffer | null> {
  const f = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: {
      cliente: true,
      items: true,
      emisor: true,
      presupuesto: {
        select: {
          numero: true,
          formaPago: true,
          plazoEntrega: true,
          garantia: true,
          tasaFinanciacionPct: true,
          interesFinanciacion: true,
        },
      },
    },
  })
  if (!f) return null

  const emisor = f.emisor ?? (await prisma.emisor.findFirst({ where: { predeterminado: true } }))
  if (!emisor) return null

  let qrDataUrl: string | null = null
  if (f.qrData) {
    try {
      qrDataUrl = await QRCode.toDataURL(f.qrData, { width: 200 })
    } catch {
      /* QR opcional */
    }
  }

  const plantilla = await getPlantillaResuelta(f.plantillaId, 'FACTURA')
  const cfg = plantilla.config
  const datos = buildDatosFactura(
    {
      numero: f.numeroAfip ? String(f.numeroAfip).padStart(8, '0') : f.numero,
      tipo: f.tipo,
      estado: f.estado,
      fechaEmision: f.fechaEmision,
      subtotal: f.subtotal,
      iva: f.iva,
      total: f.total,
      bonificacionPct: f.bonificacionPct,
      observaciones: f.observaciones,
      condicionPago: f.condicionPago,
      cae: f.cae,
      caeVencimiento: f.caeVencimiento,
      moneda: f.moneda,
      cotizacionUsd: f.cotizacionUsd,
      items: f.items,
    },
    emisor,
    f.cliente,
    { qrDataUrl, presupuesto: f.presupuesto },
  )
  datos.items = await resolverFotosItemsPdf(datos.items)
  if (!f.plantillaId && plantilla.id) {
    prisma.factura.update({ where: { id: facturaId }, data: { plantillaId: plantilla.id } }).catch(() => {})
  }

  const pdf = await renderDocumentoPDF(cfg, datos)
  return Buffer.from(pdf)
}
