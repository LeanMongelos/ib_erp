import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { asignarSerieItemRemito } from '@/lib/remitos/venta'
import { plain } from '@/lib/serialize'

const bodySchema = z.object({
  inventarioUnidadId: z.string().min(1).optional().nullable(),
  equipoId: z.string().min(1).optional().nullable(),
  numeroSerie: z.string().trim().max(80).optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    await requirePermission('facturas.create')
    const { itemId } = await params
    const data = bodySchema.parse(await req.json())
    const item = await asignarSerieItemRemito(itemId, data)
    return NextResponse.json(plain(item))
  } catch (error) {
    return handleApiError(error)
  }
}
