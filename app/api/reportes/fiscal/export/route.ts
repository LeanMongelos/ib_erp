import { NextResponse } from 'next/server'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { auditarExportacion } from '@/lib/security/sensitive-access'
import { generarReporteFiscal, reporteFiscalToCsv } from '@/lib/reportes-fiscales'

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!tienePermiso(session.permissions, 'reportes.read_fiscal')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const data = await generarReporteFiscal()
    const csv = reporteFiscalToCsv(data)

    void auditarExportacion({
      usuarioId: session.id,
      tipo: 'reporte-fiscal',
      req,
    })

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reporte-fiscal-${Date.now()}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
