import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { getResumenAlquiler } from '@/lib/alquiler/resumen'
import { plain } from '@/lib/serialize'

export async function GET() {
  try {
    await requirePermission('alquiler.read')
    const resumen = await getResumenAlquiler()
    return NextResponse.json(plain(resumen))
  } catch (error) {
    return handleApiError(error)
  }
}
