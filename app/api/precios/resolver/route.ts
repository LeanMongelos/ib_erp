import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { resolverPrecio } from '@/lib/precios/resolver-precio'
import { plain } from '@/lib/serialize'

const querySchema = z.object({
  inventarioId: z.string().min(1),
  clienteId: z.string().min(1).optional(),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission('presupuestos.read', 'facturas.read')
    const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const resultado = await resolverPrecio(params)
    return NextResponse.json(plain(resultado))
  } catch (error) {
    if (error instanceof Error && error.message === 'Ítem de inventario no encontrado') {
      return handleApiError(new ApiError(404, error.message))
    }
    return handleApiError(error)
  }
}
