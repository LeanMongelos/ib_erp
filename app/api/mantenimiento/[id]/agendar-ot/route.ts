import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { agendarOTPreventiva } from '@/lib/mantenimiento/agendar-ot-preventiva'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('servicio.create')
    const { id } = await params

    const result = await agendarOTPreventiva(id)

    if (result.created) {
      await registrarAuditoria({
        usuarioId: actor.id,
        accion: 'mantenimiento.agendar_ot',
        entidad: 'PlanMantenimiento',
        entidadId: id,
        despues: { otId: result.ot.id, numero: result.ot.numero },
        ip: getIp(req),
      })
    }

    return NextResponse.json(plain(result), { status: result.created ? 201 : 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
