import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { moverNegocioEmbudo } from '@/lib/crm/embudo-service'

const moverSchema = z.object({
  etapaHasta: z.enum(['ENTRADA', 'CONTACTO', 'DOCUMENTACION', 'PROPUESTA', 'SEGUIMIENTO', 'ANALISIS', 'ENTREGA', 'CIERRE']),
  retroceso: z.boolean().optional(),
  datos: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('crm.reply')
    const { id } = await params
    const body = moverSchema.parse(await req.json())

    const negocio = await moverNegocioEmbudo({
      id,
      etapaHasta: body.etapaHasta,
      retroceso: body.retroceso,
      datos: body.datos,
      usuarioId: user.id,
    })

    return NextResponse.json(plain(negocio))
  } catch (error) {
    return handleApiError(error)
  }
}
