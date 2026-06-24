import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { chequeDepositoSchema } from '@/lib/validation'
import { marcarChequeDepositado, marcarChequeRechazado } from '@/lib/cobranzas/cheques'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requirePermission('cobranzas.cheques.manage')
    const { accion } = chequeDepositoSchema.parse(await req.json())

    const resultado =
      accion === 'depositar'
        ? await marcarChequeDepositado(params.id)
        : await marcarChequeRechazado(params.id)

    if (!resultado) throw new ApiError(404, 'Cheque no encontrado')

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: accion === 'depositar' ? 'cheque.depositar' : 'cheque.rechazar',
      entidad: 'ChequeCobranza',
      entidadId: params.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(resultado))
  } catch (error) {
    return handleApiError(error)
  }
}
