import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { conciliarMovimientoSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { conciliarMovimiento } from '@/lib/tesoreria/conciliar'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission('tesoreria.reconcile')
    const { id } = await params
    const data = conciliarMovimientoSchema.parse(await req.json())

    const resultado = await conciliarMovimiento(
      id,
      actor.id,
      data.extractoRef,
      data.notaConciliacion,
    )

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'tesoreria.reconcile',
      entidad: 'MovimientoTesoreria',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(resultado))
  } catch (error) {
    return handleApiError(error)
  }
}
