/**
 * Generación de PDF de presupuesto (servidor) — mismo pipeline que GET /api/presupuestos/[id]/pdf.
 */

import { prisma } from '@/lib/prisma'
import { renderDocumentoPDF } from '@/lib/plantillas/render-documento'
import { getPlantillaConfig, buildDatosPresupuesto } from '@/lib/plantillas/build-datos'
import { resolverFotosItemsPdf } from '@/lib/inventario/resolve-foto-pdf.server'

export async function generarPdfPresupuesto(presupuestoId: string): Promise<Buffer | null> {
  const pres = await prisma.presupuesto.findUnique({
    where: { id: presupuestoId },
    include: { cliente: true, items: true, emisor: true },
  })
  if (!pres?.emisor) return null

  const cfg = await getPlantillaConfig(pres.plantillaId, 'PRESUPUESTO')
  const datos = buildDatosPresupuesto(pres, pres.emisor, pres.cliente)
  datos.items = await resolverFotosItemsPdf(datos.items)
  const pdf = await renderDocumentoPDF(cfg, datos)
  return Buffer.from(pdf)
}
