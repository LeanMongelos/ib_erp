/**
 * Límite de tamaño de body HTTP (anti DoS por payloads grandes).
 */

import { ApiError } from '@/lib/api-auth'

const DEFAULT_MAX_BYTES = Number(process.env.API_MAX_BODY_BYTES ?? 5 * 1024 * 1024) // 5 MB

export function assertBodySize(req: Request, maxBytes = DEFAULT_MAX_BYTES): void {
  const cl = req.headers.get('content-length')
  if (!cl) return
  const n = parseInt(cl, 10)
  if (Number.isFinite(n) && n > maxBytes) {
    throw new ApiError(413, 'El cuerpo de la solicitud es demasiado grande')
  }
}

export const UPLOAD_MAX_BYTES = Number(process.env.API_UPLOAD_MAX_BYTES ?? 12 * 1024 * 1024)
