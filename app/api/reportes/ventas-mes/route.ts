import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { obtenerFacturasVentasMesActual, ventasMesToCsv } from '@/lib/reportes-ventas-mes'

export async function GET() {
  try {
    const session = await requireAuth()
    if (
      !tienePermiso(session.permissions, 'facturas.read') &&
      !tienePermiso(session.permissions, 'reportes.read_comercial')
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const facturas = await obtenerFacturasVentasMesActual()
    const csv = ventasMesToCsv(facturas)
    const mes = format(new Date(), 'yyyy-MM', { locale: es })

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ventas-${mes}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
