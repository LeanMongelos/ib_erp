/**
 * Auditoría de acceso a datos sensibles (clientes, historia clínica, exportaciones).
 */

import { registrarAuditoria, getIp } from '@/lib/audit'

export async function auditarAccesoSensible(params: {
  usuarioId: string
  accion: string
  entidad: string
  entidadId?: string | null
  req?: Request
  meta?: Record<string, unknown>
}): Promise<void> {
  await registrarAuditoria({
    usuarioId: params.usuarioId,
    accion: params.accion,
    entidad: params.entidad,
    entidadId: params.entidadId ?? null,
    despues: params.meta ?? undefined,
    ip: params.req ? getIp(params.req) : null,
  })
}

export async function auditarExportacion(params: {
  usuarioId: string
  tipo: string
  req?: Request
  meta?: Record<string, unknown>
}): Promise<void> {
  await auditarAccesoSensible({
    usuarioId: params.usuarioId,
    accion: 'export.download',
    entidad: 'Export',
    entidadId: params.tipo,
    req: params.req,
    meta: params.meta,
  })
}
