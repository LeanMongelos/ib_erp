import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { fleteUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { actualizarFlete, obtenerFlete } from '@/lib/fletes/crud'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('fletes.read')
    const { id } = await params
    const flete = await obtenerFlete(id)
    return NextResponse.json(plain(flete))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('fletes.update')
    const { id } = await params
    const data = fleteUpdateSchema.parse(await req.json())
    const flete = await actualizarFlete(id, data)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'flete.update',
      entidad: 'SeguimientoFlete',
      entidadId: id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(flete))
  } catch (error) {
    return handleApiError(error)
  }
}
