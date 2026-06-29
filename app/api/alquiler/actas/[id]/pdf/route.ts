import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { generarPdfActaEntregaAlquiler } from '@/lib/alquiler/acta-pdf'
import { obtenerActaEntregaAlquiler } from '@/lib/alquiler/acta-entrega'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission('alquiler.read')
    const acta = await obtenerActaEntregaAlquiler(params.id)
    const pdf = await generarPdfActaEntregaAlquiler(params.id)
    if (!pdf) {
      return NextResponse.json({ error: 'No se pudo generar el PDF del ACTA' }, { status: 400 })
    }

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="acta-${acta.numero}.pdf"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
