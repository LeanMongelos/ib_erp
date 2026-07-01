import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-auth'
import { applySecurityHeaders } from '@/lib/security/headers'
import { rechazarSiMlNoAutorizado } from '@/lib/ml/auth'
import { getClientesMl } from '@/lib/ml/handoff'

/**
 * GET /api/ml/clientes
 * API de lectura para el partner ML. Auth: `Authorization: Bearer <ML_API_KEY>`.
 *
 * Query opcional:
 *   ?cliente=<id>  → filtra a un solo cliente (equipos + asignaciones de ese cliente)
 *
 * Devuelve clientes activos con equipos acotados (marca, modelo, serie, estado,
 * origen, asignaciones, catálogo con `tieneFotoReferencia`). Sin datos de contacto.
 */
export async function GET(req: NextRequest) {
  try {
    const rechazo = rechazarSiMlNoAutorizado(req)
    if (rechazo) return rechazo

    const clienteId = new URL(req.url).searchParams.get('cliente')?.trim() || undefined
    const clientes = await getClientesMl({ clienteId })

    return applySecurityHeaders(
      NextResponse.json({ generatedAt: new Date().toISOString(), schemaVersion: 2, clientes }),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
