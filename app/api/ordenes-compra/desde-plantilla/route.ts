import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { crearOcDesdePlantilla } from '@/lib/compras/oc-desde'

const bodySchema = z.object({ plantillaId: z.string().min(1) })

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.create')
    const { plantillaId } = bodySchema.parse(await req.json())

    const oc = await crearOcDesdePlantilla(plantillaId, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.create_desde_plantilla',
      entidad: 'OrdenCompra',
      entidadId: oc.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(oc), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
