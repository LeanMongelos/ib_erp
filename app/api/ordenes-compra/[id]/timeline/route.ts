import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { construirTimelineOc } from '@/lib/compras/oc-workflow/timeline'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('compras.read')
    const { id } = await params
    const timeline = await construirTimelineOc(id)
    if (!timeline) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 })
    }
    return NextResponse.json(plain(timeline))
  } catch (error) {
    return handleApiError(error)
  }
}
