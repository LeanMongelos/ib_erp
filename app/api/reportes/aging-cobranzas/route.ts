import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { agingCobranzasToCsv, obtenerCuotasAgingPendientes } from '@/lib/reportes-aging-cobranzas'

export async function GET() {
  try {
    const session = await requireAuth()
    if (
      !tienePermiso(session.permissions, 'cobranzas.read') &&
      !tienePermiso(session.permissions, 'reportes.read_financiero')
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const cuotas = await obtenerCuotasAgingPendientes()
    const csv = agingCobranzasToCsv(cuotas)
    const stamp = format(new Date(), 'yyyy-MM-dd', { locale: es })

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="aging-cobranzas-${stamp}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
