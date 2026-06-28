import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionAny, handleApiError } from '@/lib/api-auth'
import { geocodificarSucursal, geocodificarLineaAlquiler } from '@/lib/geocoding'

export async function GET(req: NextRequest) {
  try {
    await requirePermissionAny('clientes.read', 'servicio.read', 'alquiler.read')
    const direccion = req.nextUrl.searchParams.get('direccion')?.trim()
    const domicilio = req.nextUrl.searchParams.get('domicilio')?.trim()
    const numero = req.nextUrl.searchParams.get('numero')?.trim() ?? ''
    const localidad = req.nextUrl.searchParams.get('localidad')?.trim()
      ?? req.nextUrl.searchParams.get('ciudad')?.trim()
      ?? 'Formosa'
    const provincia = req.nextUrl.searchParams.get('provincia')?.trim() ?? 'Formosa'

    if (domicilio) {
      const geo = await geocodificarLineaAlquiler(domicilio, localidad, provincia)
      if (!geo) {
        return NextResponse.json({ error: 'Dirección no encontrada en el mapa' }, { status: 404 })
      }
      return NextResponse.json(geo)
    }

    if (!direccion) {
      return NextResponse.json({ error: 'Parámetro direccion o domicilio requerido' }, { status: 400 })
    }

    const geo = await geocodificarSucursal(direccion, numero || null, localidad)
    if (!geo) {
      return NextResponse.json({ error: 'Dirección no encontrada en el mapa' }, { status: 404 })
    }

    return NextResponse.json(geo)
  } catch (error) {
    return handleApiError(error)
  }
}
