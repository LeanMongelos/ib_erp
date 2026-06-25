import { NextResponse } from 'next/server'
import { requireRole, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { reactivarNegocioEmbudo } from '@/lib/crm/embudo-service'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('SUPERADMIN')
    const { id } = await params
    const negocio = await reactivarNegocioEmbudo(id, user.id)
    return NextResponse.json(plain(negocio))
  } catch (error) {
    return handleApiError(error)
  }
}
