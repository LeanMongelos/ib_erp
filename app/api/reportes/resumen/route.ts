import { NextResponse } from 'next/server'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { generarResumenReportes } from '@/lib/reportes'
import { generarReporteFiscal } from '@/lib/reportes-fiscales'

export async function GET() {
  try {
    const session = await requireAuth()
    const permisos = session.permissions ?? []

    const puedeComercial = tienePermiso(permisos, 'reportes.read_comercial')
    const puedeFinanciero = tienePermiso(permisos, 'reportes.read_financiero')
    const puedeOperativo = tienePermiso(permisos, 'reportes.read_operativo')

    const puedeFiscal = tienePermiso(permisos, 'reportes.read_fiscal')

    if (!puedeComercial && !puedeFinanciero && !puedeOperativo && !puedeFiscal) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const [resumen, fiscal] = await Promise.all([
      generarResumenReportes(),
      puedeFiscal ? generarReporteFiscal() : Promise.resolve(null),
    ])

    return NextResponse.json({
      comercial: puedeComercial ? resumen.comercial : null,
      financiero: puedeFinanciero ? resumen.financiero : null,
      operativo: puedeOperativo ? resumen.operativo : null,
      fiscal,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
