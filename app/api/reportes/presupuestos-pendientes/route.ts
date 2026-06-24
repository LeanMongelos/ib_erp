import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import {
  obtenerPresupuestosPendientes,
  presupuestosPendientesToCsv,
} from '@/lib/reportes-presupuestos-pendientes'

export async function GET() {
  try {
    const session = await requireAuth()
    if (
      !tienePermiso(session.permissions, 'presupuestos.read') &&
      !tienePermiso(session.permissions, 'reportes.read_comercial')
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const presupuestos = await obtenerPresupuestosPendientes()
    const csv = presupuestosPendientesToCsv(presupuestos)
    const fecha = format(new Date(), 'yyyy-MM-dd')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="presupuestos-pendientes-${fecha}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
