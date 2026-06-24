import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { pagoAccionSchema } from '@/lib/validation'
import { revertirPagoNoCheque } from '@/lib/cobranzas/revertir-pago'
import { conciliarPago } from '@/lib/cobranzas/conciliar-pago'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { accion } = pagoAccionSchema.parse(await req.json())

    if (accion === 'anular') {
      const actor = await requirePermission('cobranzas.register_payment')
      const resultado = await revertirPagoNoCheque(id)

      await registrarAuditoria({
        usuarioId: actor.id,
        accion: 'cobranza.revert',
        entidad: 'Pago',
        entidadId: id,
        ip: getIp(req),
      })

      return NextResponse.json(plain(resultado))
    }

    const actor = await requirePermission('cobranzas.reconcile')
    const resultado = await conciliarPago(id, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'cobranza.reconcile',
      entidad: 'Pago',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(resultado))
  } catch (error) {
    return handleApiError(error)
  }
}
