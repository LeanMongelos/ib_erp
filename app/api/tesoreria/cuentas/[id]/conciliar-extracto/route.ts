import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { conciliarExtractoSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { aplicarConciliacionExtracto } from '@/lib/tesoreria/conciliar-extracto'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission('tesoreria.reconcile')
    const { id: cuentaId } = await params
    const data = conciliarExtractoSchema.parse(await req.json())

    const conciliados = await aplicarConciliacionExtracto(data.matches, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'tesoreria.conciliar_extracto',
      entidad: 'CuentaTesoreria',
      entidadId: cuentaId,
      despues: { cantidad: conciliados.length },
      ip: getIp(req),
    })

    return NextResponse.json(plain({ ok: true, conciliados: conciliados.length }))
  } catch (error) {
    return handleApiError(error)
  }
}
