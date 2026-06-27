import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { aprobarOc } from '@/lib/compras/oc-workflow/aprobacion'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.approve')
    const { id } = await params

    const updated = await aprobarOc(id, actor.id, actor.name ?? actor.email ?? 'Usuario')

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.aprobar',
      entidad: 'OrdenCompra',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(updated))
  } catch (error) {
    return handleApiError(error)
  }
}
