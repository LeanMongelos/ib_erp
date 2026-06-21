/**
 * lib/audit.ts
 * Registro de auditoría. Guarda quién hizo qué, sobre qué entidad y cuándo,
 * con el estado anterior/posterior cuando aplica.
 *
 * Nunca debe hacer fallar la operación principal: si el log falla, se loguea en
 * consola pero no se propaga el error.
 */

import { prisma } from '@/lib/prisma'

export interface AuditInput {
  usuarioId?: string | null
  accion: string // ej. "usuario.create", "emisor.update"
  entidad: string // ej. "Usuario", "Emisor"
  entidadId?: string | null
  antes?: unknown
  despues?: unknown
  ip?: string | null
}

export async function registrarAuditoria(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        usuarioId: input.usuarioId ?? null,
        accion: input.accion,
        entidad: input.entidad,
        entidadId: input.entidadId ?? null,
        antes: (input.antes ?? undefined) as any,
        despues: (input.despues ?? undefined) as any,
        ip: input.ip ?? null,
      },
    })
  } catch (error) {
    console.error('[audit] no se pudo registrar la auditoría:', error)
  }
}

/** Obtiene la IP del request (considerando proxies del VPS). */
export function getIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}
