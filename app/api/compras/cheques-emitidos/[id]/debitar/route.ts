import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { chequeEmitidoDebitarSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { marcarChequeDebitado } from '@/lib/compras/cheque-emitido'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.pay')
    const { id } = await params
    const data = chequeEmitidoDebitarSchema.parse(await req.json().catch(() => ({})))

    const cheque = await marcarChequeDebitado(id, actor.id, data.fechaDebito)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'cheque_emitido.debitar',
      entidad: 'ChequeEmitido',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(cheque))
  } catch (error) {
    return handleApiError(error)
  }
}
