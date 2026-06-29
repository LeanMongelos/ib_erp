import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { actaEntregaAlquilerCreateSchema } from '@/lib/validation'
import { crearActaEntregaAlquiler, listarActasEntregaContrato } from '@/lib/alquiler/acta-entrega'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requirePermission('alquiler.read')
    const actas = await listarActasEntregaContrato(params.id)
    return NextResponse.json(plain(actas))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requirePermission('alquiler.bill')
    const body = await req.json()
    const data = actaEntregaAlquilerCreateSchema.parse(body)

    const acta = await crearActaEntregaAlquiler(params.id, data, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'alquiler.acta.create',
      entidad: 'ActaEntregaAlquiler',
      entidadId: acta.id,
      despues: { contratoId: params.id, lineaId: data.lineaId, numero: acta.numero },
      ip: getIp(req),
    })

    return NextResponse.json(plain(acta), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
