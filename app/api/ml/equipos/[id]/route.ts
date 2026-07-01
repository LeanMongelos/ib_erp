import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, ApiError } from '@/lib/api-auth'
import { applySecurityHeaders } from '@/lib/security/headers'
import { rechazarSiMlNoAutorizado } from '@/lib/ml/auth'
import { getEquipoMl } from '@/lib/ml/handoff'

/**
 * GET /api/ml/equipos/[id]
 * Ficha acotada de un equipo para el partner ML.
 * Auth: `Authorization: Bearer <ML_API_KEY>`.
 *
 * Devuelve marca, modelo, serie, estado, origen, clienteId/clienteNombre,
 * historial de asignaciones y catálogo vinculado (`tieneFotoReferencia`).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rechazo = rechazarSiMlNoAutorizado(req)
    if (rechazo) return rechazo

    const { id } = await params
    const equipo = await getEquipoMl(id)
    if (!equipo) throw new ApiError(404, 'Equipo no encontrado')

    return applySecurityHeaders(NextResponse.json(equipo))
  } catch (error) {
    return handleApiError(error)
  }
}
