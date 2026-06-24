import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { renderDocumentoPDF } from '@/lib/plantillas/render-documento'
import { getPlantillaConfig, buildDatosFactura } from '@/lib/plantillas/build-datos'
import { resolverFotosItemsPdf } from '@/lib/inventario/resolve-foto-pdf.server'
import QRCode from 'qrcode'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('facturas.read')
    const { id } = await params
    const f = await prisma.factura.findUnique({
      where: { id },
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
    if (!f) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const emisor = f.emisor ?? await prisma.emisor.findFirst({ where: { predeterminado: true } })
    if (!emisor) return NextResponse.json({ error: 'Sin emisor' }, { status: 400 })

    let qrDataUrl: string | null = null
    if (f.qrData) {
      try { qrDataUrl = await QRCode.toDataURL(f.qrData, { width: 200 }) } catch { /* ignore */ }
    }

    const cfg = await getPlantillaConfig(f.plantillaId, 'FACTURA')
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
        items: f.items,
      },
      emisor,
      f.cliente,
      { qrDataUrl, presupuesto: f.presupuesto },
    )
    datos.items = await resolverFotosItemsPdf(datos.items)
    const pdf = await renderDocumentoPDF(cfg, datos)

    return new NextResponse(new Uint8Array(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="factura-${f.numero}.pdf"` },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
