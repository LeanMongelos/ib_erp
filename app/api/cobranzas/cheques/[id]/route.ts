import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { chequeDepositoSchema } from '@/lib/validation'
import { marcarChequeDepositado, marcarChequeRechazado, marcarChequeAnulado } from '@/lib/cobranzas/cheques'
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
        ? await marcarChequeDepositado(params.id, actor.id)
        : accion === 'rechazar'
          ? await marcarChequeRechazado(params.id)
          : await marcarChequeAnulado(params.id)

    if (!resultado) throw new ApiError(404, 'Cheque no encontrado')

    await registrarAuditoria({
      usuarioId: actor.id,
      accion:
        accion === 'depositar'
          ? 'cheque.depositar'
          : accion === 'rechazar'
            ? 'cheque.rechazar'
            : 'cheque.anular',
      entidad: 'ChequeCobranza',
      entidadId: params.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(resultado))
  } catch (error) {
    return handleApiError(error)
  }
}
