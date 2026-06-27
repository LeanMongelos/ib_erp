import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { consultarAlertasCompra } from '@/lib/compras/alertas-compra'

export async function GET() {
  try {
    const actor = await requirePermission('compras.read')
    const alertas = await consultarAlertasCompra(actor.id)
    return NextResponse.json(plain(alertas))
  } catch (error) {
    return handleApiError(error)
  }
}
