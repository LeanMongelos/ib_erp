import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { anularFacturaCompra } from '@/lib/compras/factura-compra-crud'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.invoice')
    const { id } = await params

    const fc = await anularFacturaCompra(actor.id, id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'fc_compra.anular',
      entidad: 'FacturaCompra',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(fc))
  } catch (error) {
    return handleApiError(error)
  }
}
