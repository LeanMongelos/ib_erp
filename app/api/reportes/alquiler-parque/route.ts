import { NextResponse } from 'next/server'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { obtenerParqueAlquilerActivo, parqueAlquilerToCsv } from '@/lib/reportes-alquiler-parque'

export async function GET() {
  try {
    const session = await requireAuth()
    if (
      !tienePermiso(session.permissions, 'alquiler.export') &&
      !tienePermiso(session.permissions, 'reportes.read_operativo')
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const lineas = await obtenerParqueAlquilerActivo()
    const csv = parqueAlquilerToCsv(lineas)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="alquiler-parque-activo.csv"',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
