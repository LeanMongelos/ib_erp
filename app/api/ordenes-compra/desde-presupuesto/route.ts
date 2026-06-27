import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { crearOcDesdePresupuesto } from '@/lib/compras/oc-desde'

const bodySchema = z.object({ presupuestoId: z.string().min(1) })

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.create')
    const { presupuestoId } = bodySchema.parse(await req.json())

    const oc = await crearOcDesdePresupuesto(presupuestoId, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.create_desde_presupuesto',
      entidad: 'OrdenCompra',
      entidadId: oc.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(oc), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
