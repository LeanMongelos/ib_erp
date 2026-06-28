import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { devolverLineaAlquiler } from '@/lib/alquiler/devolver-linea'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requirePermission('alquiler.close')
    const linea = await devolverLineaAlquiler(params.id, { usuarioId: actor.id })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'alquiler.linea.devolver',
      entidad: 'LineaAlquiler',
      entidadId: params.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(linea))
  } catch (error) {
    return handleApiError(error)
  }
}
