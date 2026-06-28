import { NextResponse } from 'next/server'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { mrrAlquilerToCsv, obtenerMrrAlquiler } from '@/lib/reportes-alquiler-mrr'

export async function GET() {
  try {
    const session = await requireAuth()
    if (
      !tienePermiso(session.permissions, 'alquiler.export') &&
      !tienePermiso(session.permissions, 'reportes.read_financiero')
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const data = await obtenerMrrAlquiler()
    const csv = mrrAlquilerToCsv(data)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="alquiler-mrr.csv"',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
