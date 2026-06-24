import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { obtenerOtsAbiertas, otsAbiertasToCsv } from '@/lib/reportes-ots-abiertas'

export async function GET() {
  try {
    const session = await requireAuth()
    if (
      !tienePermiso(session.permissions, 'servicio.read') &&
      !tienePermiso(session.permissions, 'reportes.read_operativo')
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const ots = await obtenerOtsAbiertas()
    const csv = otsAbiertasToCsv(ots)
    const fecha = format(new Date(), 'yyyy-MM-dd')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ots-abiertas-${fecha}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
