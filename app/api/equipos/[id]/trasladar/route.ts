import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { equipoTrasladoSchema } from '@/lib/validation'
import { trasladarEquipoACliente } from '@/lib/equipos/asignaciones'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('servicio.update')
    const { id } = await params
    const body = equipoTrasladoSchema.parse(await req.json())

    const asignacion = await trasladarEquipoACliente({
      equipoId: id,
      clienteIdDestino: body.clienteId,
      sucursalIdDestino: body.sucursalId,
      motivo: body.motivo,
      observaciones: body.observaciones,
      usuarioId: actor.id,
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'equipo.trasladar',
      entidad: 'Equipo',
      entidadId: id,
      despues: body,
      ip: getIp(req),
    })

    return NextResponse.json(plain(asignacion))
  } catch (error) {
    return handleApiError(error)
  }
}
