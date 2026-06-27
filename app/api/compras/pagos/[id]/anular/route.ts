import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { anularPagoProveedor } from '@/lib/compras/pago-proveedor'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.pay')
    const { id } = await params

    const pago = await anularPagoProveedor(actor.id, id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'pago_proveedor.anular',
      entidad: 'PagoProveedor',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(pago))
  } catch (error) {
    return handleApiError(error)
  }
}
