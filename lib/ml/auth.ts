/**
 * lib/ml/auth.ts
 * Autorización de la API de lectura del partner ML (visión).
 *
 * Patrón espejo de `lib/cron/auth.ts`: token de servicio por header
 *   `Authorization: Bearer <ML_API_KEY>`.
 * A diferencia de las rutas del dashboard, NO usa sesión NextAuth (el motor ML
 * es un sistema externo). El secreto vive en `.env` (nunca en git).
 */

import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders } from '@/lib/security/headers'

/**
 * Rechaza si falta `ML_API_KEY` (503) o el Bearer no coincide (401).
 * Devuelve `null` si la request está autorizada.
 */
export function rechazarSiMlNoAutorizado(req: NextRequest): NextResponse | null {
  const secret = process.env.ML_API_KEY?.trim()
  if (!secret) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'No autorizado' }, { status: 503 }),
    ) as NextResponse
  }

  const auth = req.headers.get('authorization')?.trim()
  if (!auth || auth !== `Bearer ${secret}`) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    ) as NextResponse
  }

  return null
}
