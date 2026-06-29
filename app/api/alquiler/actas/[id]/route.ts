import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { actaEntregaAlquilerUpdateSchema } from '@/lib/validation'
import { actualizarActaEntregaAlquiler, obtenerActaEntregaAlquiler } from '@/lib/alquiler/acta-entrega'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requirePermission('alquiler.read')
    const acta = await obtenerActaEntregaAlquiler(params.id)
    return NextResponse.json(plain(acta))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requirePermission('alquiler.bill')
    const body = await req.json()
    const data = actaEntregaAlquilerUpdateSchema.parse(body)

    const acta = await actualizarActaEntregaAlquiler(params.id, data)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'alquiler.acta.update',
      entidad: 'ActaEntregaAlquiler',
      entidadId: acta.id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(acta))
  } catch (error) {
    return handleApiError(error)
  }
}
