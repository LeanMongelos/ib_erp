import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { generarPdfEntregaFactura } from '@/lib/facturas/entrega-pdf'

/**
 * GET /api/facturas/[id]/entrega
 * PDF de entrega = factura + brochures de los equipos vendidos (si los hay).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('facturas.read')
    const { id } = await params

    const f = await prisma.factura.findUnique({ where: { id }, select: { numero: true } })
    if (!f) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const res = await generarPdfEntregaFactura(id)
    if (!res) return NextResponse.json({ error: 'No se pudo generar el PDF de entrega' }, { status: 400 })

    return new NextResponse(new Uint8Array(res.pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="entrega-${f.numero}.pdf"`,
        'X-Brochures-Incluidos': String(res.brochures),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
