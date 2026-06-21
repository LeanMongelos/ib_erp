import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { generarPlantillaInventarioXlsx } from '@/lib/inventario-excel'

export async function GET() {
  try {
    await requirePermission('inventario.read')
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
