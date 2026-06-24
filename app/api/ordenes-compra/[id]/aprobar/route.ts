import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.approve')
    const { id } = await params

    const oc = await prisma.ordenCompra.findUnique({ where: { id } })
    if (!oc) throw new ApiError(404, 'Orden de compra no encontrada')
    if (oc.estado !== 'BORRADOR') {
      throw new ApiError(400, `Solo se aprueban OC en borrador (actual: ${oc.estado})`)
    }

    const updated = await prisma.ordenCompra.update({
      where: { id },
      data: { estado: 'ENVIADA' },
      include: { proveedor: true, items: true },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.aprobar',
      entidad: 'OrdenCompra',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(updated))
  } catch (error) {
    return handleApiError(error)
  }
}
