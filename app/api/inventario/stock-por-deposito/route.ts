import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import {
  consultarStockPorDeposito,
  filasStockACsv,
} from '@/lib/inventario/stock-por-deposito-report'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('inventario.read')
    const url = new URL(req.url)
    const depositoId = url.searchParams.get('depositoId')
    const inventarioId = url.searchParams.get('inventarioId')
    const formato = url.searchParams.get('formato')

    const filas = await consultarStockPorDeposito({
      depositoId: depositoId || undefined,
      inventarioId: inventarioId || undefined,
    })

    if (formato === 'csv') {
      const csv = filasStockACsv(filas)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="stock-por-deposito.csv"',
        },
      })
    }

    return NextResponse.json(plain(filas))
  } catch (error) {
    return handleApiError(error)
  }
}
