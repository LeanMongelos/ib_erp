import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { resumenCuentaCorrienteProveedor } from '@/lib/compras/cuenta-corriente'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('compras.read')
    const { id } = await params
    const data = await resumenCuentaCorrienteProveedor(id)
    return NextResponse.json(plain(data))
  } catch (error) {
    return handleApiError(error)
  }
}
