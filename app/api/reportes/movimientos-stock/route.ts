import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import {
  movimientosStockToCsv,
  obtenerMovimientosStock,
  parseRangoMovimientosStock,
} from '@/lib/reportes-movimientos-stock'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()
    if (
      !tienePermiso(session.permissions, 'inventario.read') &&
      !tienePermiso(session.permissions, 'reportes.read_operativo')
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    const rango = parseRangoMovimientosStock(
      searchParams.get('desde'),
      searchParams.get('hasta'),
    )

    if ('error' in rango) {
      return NextResponse.json({ error: rango.error }, { status: 400 })
    }

    const movimientos = await obtenerMovimientosStock(rango)
    const csv = movimientosStockToCsv(movimientos, rango)
    const labelDesde = format(rango.desde, 'yyyy-MM-dd')
    const labelHasta = format(rango.hasta, 'yyyy-MM-dd')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="movimientos-stock-${labelDesde}_${labelHasta}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
