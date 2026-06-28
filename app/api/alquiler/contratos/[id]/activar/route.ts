import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { activarContratoAlquiler } from '@/lib/alquiler/activar-contrato'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requirePermission('alquiler.update')

    const contrato = await activarContratoAlquiler(params.id, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'alquiler.contrato.activar',
      entidad: 'ContratoAlquiler',
      entidadId: contrato.id,
      despues: { estado: 'ACTIVO', numero: contrato.numero },
      ip: getIp(req),
    })

    return NextResponse.json(plain(contrato))
  } catch (error) {
    return handleApiError(error)
  }
}
