import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { exportarClientesCsv } from '@/lib/clientes/export-csv'

export async function GET() {
  try {
    await requirePermission('clientes.read')
    const csv = await exportarClientesCsv()

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="clientes-ibiomedica-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
