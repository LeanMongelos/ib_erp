import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { getEquiposParaMapa } from '@/lib/tracking'
import { plain } from '@/lib/serialize'
import type { EstadoEquipo, OrigenEquipo } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('tracking.read')
    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId') ?? undefined
    const estadoRaw = searchParams.get('estado')
    const origenRaw = searchParams.get('origen')
    const estado = estadoRaw as EstadoEquipo | undefined
    const origen = origenRaw as OrigenEquipo | 'TODOS' | undefined

    const equipos = await getEquiposParaMapa({
      clienteId,
      estado: estado && ['ACTIVO', 'EN_REPARACION', 'BAJA'].includes(estado) ? estado : undefined,
      origen: origen && ['VENTA', 'ALQUILER', 'EXTERNO', 'MANUAL_ST', 'TODOS'].includes(origen) ? origen : undefined,
    })

    return NextResponse.json(plain(equipos))
  } catch (error) {
    return handleApiError(error)
  }
}
