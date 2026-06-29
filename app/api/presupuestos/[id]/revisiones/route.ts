import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { listarVersionesPresupuesto } from '@/lib/presupuestos/revision'
import { plain } from '@/lib/serialize'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('presupuestos.read')
    const { id } = await params
    const versiones = await listarVersionesPresupuesto(id)
    return NextResponse.json(plain(versiones))
  } catch (error) {
    return handleApiError(error)
  }
}
