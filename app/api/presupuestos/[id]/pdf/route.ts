import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { renderDocumentoPDF } from '@/lib/plantillas/render-documento'
import { getPlantillaConfig, buildDatosPresupuesto } from '@/lib/plantillas/build-datos'
import { resolverFotosItemsPdf } from '@/lib/inventario/resolve-foto-pdf.server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('presupuestos.read')
    const { id } = await params

    const pres = await prisma.presupuesto.findUnique({
      where: { id },
      include: { cliente: true, items: true, emisor: true },
    })
    if (!pres) throw new ApiError(404, 'Presupuesto no encontrado')
    if (!pres.emisor) throw new ApiError(400, 'El presupuesto no tiene emisor asignado')

    const cfg = await getPlantillaConfig(pres.plantillaId, 'PRESUPUESTO')
    const datos = buildDatosPresupuesto(pres, pres.emisor, pres.cliente)
    datos.items = await resolverFotosItemsPdf(datos.items)
    const pdf = await renderDocumentoPDF(cfg, datos)

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="presupuesto-${pres.numero}.pdf"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
