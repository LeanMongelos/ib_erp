import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { generarPlantillaCsvProveedores } from '@/lib/proveedores/parse-csv-proveedores'

export async function GET() {
  try {
    await requirePermission('proveedores.read')
    const csv = generarPlantillaCsvProveedores()

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="plantilla-proveedores-ibiomedica.csv"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
