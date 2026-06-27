import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { enviarOcAprobacion } from '@/lib/compras/oc-workflow/aprobacion'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.create')
    const { id } = await params

    const updated = await enviarOcAprobacion(id, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.enviar_aprobacion',
      entidad: 'OrdenCompra',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(updated))
  } catch (error) {
    return handleApiError(error)
  }
}
