/**
 * "Paquete de entrega" de una factura: PDF de la factura + los brochures (PDF)
 * de los equipos vendidos que tengan uno cargado. Deduplicado por producto.
 *
 * El comprobante fiscal sigue siendo la factura; los brochures son anexos
 * informativos para la entrega formal del equipamiento.
 */
import { PDFDocument } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { generarPdfFactura } from './generar-pdf'
import { getStorage } from '@/lib/storage'
import { storageKeyFromInventarioBrochureUrl } from '@/lib/inventario/brochure-storage'

export type EntregaPdfResult = { pdf: Buffer; brochures: number }

/** Genera el PDF combinado factura + brochures. `null` si la factura no existe. */
export async function generarPdfEntregaFactura(facturaId: string): Promise<EntregaPdfResult | null> {
  const facturaPdf = await generarPdfFactura(facturaId)
  if (!facturaPdf) return null

  // Productos vendidos con brochure, deduplicados por producto.
  const items = await prisma.itemFactura.findMany({
    where: { facturaId },
    select: { inventario: { select: { id: true, brochureUrl: true } } },
  })
  const brochurePorProducto = new Map<string, string>()
  for (const it of items) {
    const inv = it.inventario
    if (inv?.brochureUrl?.trim()) brochurePorProducto.set(inv.id, inv.brochureUrl)
  }

  const merged = await PDFDocument.create()
  merged.setTitle('Factura + brochures — entrega')

  // 1) Factura
  const facturaDoc = await PDFDocument.load(facturaPdf)
  const facturaPages = await merged.copyPages(facturaDoc, facturaDoc.getPageIndices())
  facturaPages.forEach((p) => merged.addPage(p))

  // 2) Brochures de los equipos vendidos (los corruptos/no-PDF se omiten).
  const storage = getStorage()
  let brochures = 0
  for (const url of brochurePorProducto.values()) {
    const key = storageKeyFromInventarioBrochureUrl(url)
    if (!key) continue
    try {
      if (!(await storage.exists(key))) continue
      const buf = await storage.get(key)
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
      const pages = await merged.copyPages(doc, doc.getPageIndices())
      pages.forEach((p) => merged.addPage(p))
      brochures++
    } catch {
      // brochure ilegible → se omite, no rompe la entrega
    }
  }

  const bytes = await merged.save()
  return { pdf: Buffer.from(bytes), brochures }
}
