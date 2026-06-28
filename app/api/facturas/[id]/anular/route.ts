import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { requireSecureMutation } from '@/lib/security/secure-mutation'
import { procesarAnulacionFactura } from '@/lib/facturas/anular'
import { plain } from '@/lib/serialize'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSecureMutation(req, 'facturas.cancel')
    const { id } = await params

    const previa = await prisma.factura.findUnique({
      where: { id },
      select: { cae: true, estado: true },
    })
    if (!previa) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const requiereNc =
      !!previa.cae && ['EMITIDA', 'VENCIDA'].includes(previa.estado)
    if (requiereNc) {
      await requirePermission('facturas.credit_note')
    }

    const result = await procesarAnulacionFactura(id, actor.id)

    return NextResponse.json(plain({
      factura: result.factura,
      notaCredito: result.notaCredito,
      simulado: result.simulado,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}
