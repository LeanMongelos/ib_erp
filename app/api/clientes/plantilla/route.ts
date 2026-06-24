import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { generarPlantillaCsvClientes } from '@/lib/clientes/parse-csv-clientes'

export async function GET() {
  try {
    await requirePermission('clientes.read')
    const csv = generarPlantillaCsvClientes()

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="plantilla-clientes-ibiomedica.csv"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
