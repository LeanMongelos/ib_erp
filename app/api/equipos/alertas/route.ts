import { NextResponse } from 'next/server'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { getAlertasComponentesEquipos } from '@/lib/equipos/historia-clinica'
import { plain } from '@/lib/serialize'

export async function GET() {
  try {
    await requireAuth()
    const alertas = await getAlertasComponentesEquipos(120)
    return NextResponse.json(plain(alertas))
  } catch (error) {
    return handleApiError(error)
  }
}
