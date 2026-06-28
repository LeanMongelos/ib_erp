import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { suspenderContratoAlquiler, reactivarContratoAlquiler } from '@/lib/alquiler/estado-contrato'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requirePermission('alquiler.close')
    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion') ?? 'suspender'

    const contrato =
      accion === 'reactivar'
        ? await reactivarContratoAlquiler(params.id)
        : await suspenderContratoAlquiler(params.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: accion === 'reactivar' ? 'alquiler.contrato.reactivar' : 'alquiler.contrato.suspender',
      entidad: 'ContratoAlquiler',
      entidadId: contrato.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(contrato))
  } catch (error) {
    return handleApiError(error)
  }
}
