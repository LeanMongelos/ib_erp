import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { cancelarContratoAlquiler } from '@/lib/alquiler/estado-contrato'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requirePermission('alquiler.close')
    const contrato = await cancelarContratoAlquiler(params.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'alquiler.contrato.cancelar',
      entidad: 'ContratoAlquiler',
      entidadId: contrato.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(contrato))
  } catch (error) {
    return handleApiError(error)
  }
}
