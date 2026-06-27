import { NextRequest, NextResponse } from 'next/server'
import { requireRole, handleApiError } from '@/lib/api-auth'
import { invalidarTodasLasSesiones } from '@/lib/config/politica-seguridad'
import { registrarAuditoria, getIp } from '@/lib/audit'

/** Cierra sesión a todos los usuarios incrementando sesionEpoch (solo SUPERADMIN). */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole('SUPERADMIN')
    const sesionEpoch = await invalidarTodasLasSesiones()

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'config.seguridad.invalidar_sesiones',
      entidad: 'PoliticaSeguridad',
      entidadId: 'default',
      despues: { sesionEpoch },
      ip: getIp(req),
    })

    return NextResponse.json({
      ok: true,
      sesionEpoch,
      mensaje: 'Todas las sesiones fueron invalidadas. Cada usuario deberá volver a iniciar sesión.',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
