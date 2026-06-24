import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { moverNegocioEmbudo } from '@/lib/crm/embudo-service'
import { embudoMoverSchema } from '@/lib/validation'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('crm.reply')
    const { id } = await params
    const body = embudoMoverSchema.parse(await req.json())

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
