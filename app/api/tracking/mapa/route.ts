import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { getEquiposParaMapa } from '@/lib/tracking'
import { plain } from '@/lib/serialize'
import type { EstadoEquipo } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('tracking.read')
    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId') ?? undefined
    const estadoRaw = searchParams.get('estado')
    const estado = estadoRaw as EstadoEquipo | undefined

    const equipos = await getEquiposParaMapa({
      clienteId,
      estado: estado && ['ACTIVO', 'EN_REPARACION', 'BAJA'].includes(estado) ? estado : undefined,
    })

    return NextResponse.json(plain(equipos))
  } catch (error) {
    return handleApiError(error)
  }
}
