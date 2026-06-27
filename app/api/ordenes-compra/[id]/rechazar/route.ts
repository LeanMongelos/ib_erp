import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { ordenCompraRechazarSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { rechazarOc } from '@/lib/compras/oc-workflow/aprobacion'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.approve')
    const { id } = await params
    const { motivo } = ordenCompraRechazarSchema.parse(await req.json())

    const updated = await rechazarOc(id, actor.id, actor.name ?? actor.email ?? 'Usuario', motivo)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.rechazar',
      entidad: 'OrdenCompra',
      entidadId: id,
      despues: { motivo },
      ip: getIp(req),
    })

    return NextResponse.json(plain(updated))
  } catch (error) {
    return handleApiError(error)
  }
}
