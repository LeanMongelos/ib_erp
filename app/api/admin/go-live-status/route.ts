import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { obtenerGoLiveStatus } from '@/lib/admin/go-live-status'
import { plain } from '@/lib/serialize'

export async function GET() {
  try {
    await requirePermission('config.read')
    const status = await obtenerGoLiveStatus()
    return NextResponse.json(plain(status))
  } catch (error) {
    return handleApiError(error)
  }
}
