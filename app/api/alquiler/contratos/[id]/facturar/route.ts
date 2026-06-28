import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { facturarCuotasAlquilerSchema } from '@/lib/validation'
import { facturarCuotasAlquiler } from '@/lib/alquiler/facturar-cuotas'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requirePermission('alquiler.bill')
    const body = await req.json().catch(() => ({}))
    const data = facturarCuotasAlquilerSchema.parse(body)

    const factura = await facturarCuotasAlquiler({
      contratoId: params.id,
      periodo: data.periodo,
      cuotaIds: data.cuotaIds,
      tipo: data.tipo,
      observaciones: data.observaciones,
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'alquiler.cuotas.facturar',
      entidad: 'Factura',
      entidadId: factura!.id,
      despues: { contratoId: params.id, periodo: data.periodo },
      ip: getIp(req),
    })

    return NextResponse.json(plain(factura), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
