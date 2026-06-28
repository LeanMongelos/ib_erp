import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { auditarExportacion } from '@/lib/security/sensitive-access'
import { cobranzasMesToCsv, obtenerCuotasCobranzasMesActual } from '@/lib/reportes-cobranzas-mes'

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (
      !tienePermiso(session.permissions, 'cobranzas.read') &&
      !tienePermiso(session.permissions, 'reportes.read_financiero')
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const cuotas = await obtenerCuotasCobranzasMesActual()
    const csv = cobranzasMesToCsv(cuotas)
    const mes = format(new Date(), 'yyyy-MM', { locale: es })

    void auditarExportacion({
      usuarioId: session.id,
      tipo: `cobranzas-${mes}`,
      req,
      meta: { filas: cuotas.length },
    })

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cobranzas-${mes}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
