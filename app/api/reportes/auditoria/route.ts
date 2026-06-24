import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionAny, handleApiError } from '@/lib/api-auth'
import { AUDITORIA_EXPORT_PERMISSIONS } from '@/lib/page-permissions'
import {
  auditoriaToCsv,
  nombreArchivoAuditoria,
  obtenerAuditLogsRango,
  parseRangoAuditoria,
} from '@/lib/reportes-auditoria'

export async function GET(req: NextRequest) {
  try {
    await requirePermissionAny(...AUDITORIA_EXPORT_PERMISSIONS)

    const { searchParams } = req.nextUrl
    const rango = parseRangoAuditoria(
      searchParams.get('desde'),
      searchParams.get('hasta'),
    )

    if ('error' in rango) {
      return NextResponse.json({ error: rango.error }, { status: 400 })
    }

    const logs = await obtenerAuditLogsRango(rango)
    const csv = auditoriaToCsv(logs, rango)
    const filename = nombreArchivoAuditoria(rango)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
