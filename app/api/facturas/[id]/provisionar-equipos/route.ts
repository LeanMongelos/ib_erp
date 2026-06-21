import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { provisionarEquiposDesdeFactura } from '@/lib/equipos/provisionar-venta'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

/** Provisión manual de equipos (homologación / borrador sin pasar por AFIP). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('facturas.create')
    const { id } = await params

    const factura = await prisma.factura.findUnique({
      where: { id },
      select: { id: true, numero: true, estado: true },
    })
    if (!factura) throw new ApiError(404, 'Factura no encontrada')
    if (factura.estado === 'ANULADA') {
      throw new ApiError(400, 'No se pueden provisionar equipos en una factura anulada')
    }

    const resultado = await provisionarEquiposDesdeFactura(id, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'factura.provisionar_equipos',
      entidad: 'Factura',
      entidadId: id,
      despues: resultado,
      ip: getIp(req),
    })

    return NextResponse.json(plain(resultado))
  } catch (error) {
    return handleApiError(error)
  }
}
