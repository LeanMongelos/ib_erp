import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { facturasPorEquipoCliente } from '@/lib/clientes/facturas-equipo'
import { plain } from '@/lib/serialize'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; equipoId: string }> },
) {
  try {
    await requirePermission('facturas.read')
    const { id, equipoId } = await params
    const facturas = await facturasPorEquipoCliente(id, equipoId)
    return NextResponse.json(plain(facturas))
  } catch (error) {
    return handleApiError(error)
  }
}
