import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { geocodificarSucursal } from '@/lib/geocoding'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const direccion = req.nextUrl.searchParams.get('direccion')?.trim()
    const numero = req.nextUrl.searchParams.get('numero')?.trim() ?? ''
    const ciudad = req.nextUrl.searchParams.get('ciudad')?.trim() ?? 'Formosa'

    if (!direccion) {
      return NextResponse.json({ error: 'Parámetro direccion requerido' }, { status: 400 })
    }

    const geo = await geocodificarSucursal(direccion, numero || null, ciudad)
    if (!geo) {
      return NextResponse.json({ error: 'Dirección no encontrada en el mapa' }, { status: 404 })
    }

    return NextResponse.json(geo)
  } catch (error) {
    return handleApiError(error)
  }
}
