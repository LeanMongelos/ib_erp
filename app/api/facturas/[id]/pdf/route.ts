import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { generarPdfFactura } from '@/lib/facturas/generar-pdf'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('facturas.read')
    const { id } = await params
    const f = await prisma.factura.findUnique({ where: { id }, select: { numero: true } })
    if (!f) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const pdf = await generarPdfFactura(id)
    if (!pdf) return NextResponse.json({ error: 'No se pudo generar PDF' }, { status: 400 })

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="factura-${f.numero}.pdf"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
