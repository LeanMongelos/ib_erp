import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { getResumenContabilidad, ensureContabilidadArgentina } from '@/lib/contabilidad/seed-argentina'
import { plain } from '@/lib/serialize'

export async function GET() {
  try {
    await requirePermission('config.manage_accounting')
    const resumen = await getResumenContabilidad()
    return NextResponse.json(plain(resumen))
  } catch (error) {
    return handleApiError(error)
  }
}

/** Re-siembra catálogos default Argentina y devuelve resumen actualizado. */
export async function POST() {
  try {
    await requirePermission('config.manage_accounting')
    await ensureContabilidadArgentina()
    const resumen = await getResumenContabilidad()
    return NextResponse.json(plain(resumen))
  } catch (error) {
    return handleApiError(error)
  }
}
