import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { generarPlantillaInventarioXlsx } from '@/lib/inventario-excel'
import { generarPlantillaCsvInventario } from '@/lib/inventario/parse-csv-inventario'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('inventario.read')
    const formato = req.nextUrl.searchParams.get('formato')?.toLowerCase()

    if (formato === 'csv') {
      const csv = generarPlantillaCsvInventario()
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="plantilla-inventario-ibiomedica.csv"',
          'Cache-Control': 'no-store',
        },
      })
    }

    const buffer = generarPlantillaInventarioXlsx()

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla-inventario-ibiomedica.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
