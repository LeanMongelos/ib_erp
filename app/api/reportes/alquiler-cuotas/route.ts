import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { cuotasAlquilerToCsv, obtenerCuotasAlquilerReporte } from '@/lib/reportes-alquiler-cuotas'
import { formatPeriodo } from '@/lib/alquiler/periodo'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()
    if (
      !tienePermiso(session.permissions, 'alquiler.export') &&
      !tienePermiso(session.permissions, 'reportes.read_financiero')
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get('periodo') ?? formatPeriodo(new Date())
    const estado = searchParams.get('estado') ?? undefined

    const cuotas = await obtenerCuotasAlquilerReporte({ periodo, estado })
    const csv = cuotasAlquilerToCsv(cuotas)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="alquiler-cuotas-${periodo}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
