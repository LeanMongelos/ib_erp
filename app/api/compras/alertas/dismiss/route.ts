import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { alertaCompraDismissSchema } from '@/lib/validation'
import { dismissAlertaCompra } from '@/lib/compras/alertas-compra'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.read')
    const { alertKey } = alertaCompraDismissSchema.parse(await req.json())

    const dismiss = await dismissAlertaCompra(alertKey, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'alerta_compra.dismiss',
      entidad: 'AlertaCompraDismiss',
      entidadId: dismiss.id,
      ip: getIp(req),
      despues: { alertKey },
    })

    return NextResponse.json(plain({ ok: true, alertKey }))
  } catch (error) {
    return handleApiError(error)
  }
}
