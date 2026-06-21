import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { getFaltantesStock } from '@/lib/inventario'
import { plain } from '@/lib/serialize'

export async function GET() {
  try {
    await requirePermission('compras.read')
    const faltantes = await getFaltantesStock()
    return NextResponse.json(plain(faltantes))
  } catch (error) {
    return handleApiError(error)
  }
}
