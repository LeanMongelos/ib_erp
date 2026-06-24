import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, handleApiError } from '@/lib/api-auth'
import { buscarEnErp } from '@/lib/busqueda-global'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
    if (q.length < 2) {
      return NextResponse.json({ resultados: [], q })
    }
    const resultados = await buscarEnErp(q, user.permissions)
    return NextResponse.json(plain({ resultados, q }))
  } catch (error) {
    return handleApiError(error)
  }
}
