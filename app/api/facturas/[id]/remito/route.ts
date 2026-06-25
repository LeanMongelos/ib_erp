import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { emitirRemitoDesdeFactura } from '@/lib/remitos/emitir'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('facturas.read')
    const { id } = await params
    const preview = new URL(req.url).searchParams.get('preview') === 'true'
    const { pdf, filename } = await emitirRemitoDesdeFactura(id, { preview: preview || undefined })
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('facturas.read')
    const { id } = await params
    const { pdf, numero, filename } = await emitirRemitoDesdeFactura(id)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Remito-Numero': numero,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
