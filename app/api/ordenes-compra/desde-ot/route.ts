import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { crearOcDesdeOT } from '@/lib/compras/oc-desde'

const bodySchema = z.object({ otId: z.string().min(1) })

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.create')
    const { otId } = bodySchema.parse(await req.json())

    const oc = await crearOcDesdeOT(otId, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.create_desde_ot',
      entidad: 'OrdenCompra',
      entidadId: oc.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(oc), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
