import { NextRequest, NextResponse } from 'next/server'
import type { Prisma, TipoEventoEmbudo } from '@prisma/client'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { listarSeguimientoAgrupado } from '@/lib/crm/embudo-seguimiento-grupos'

const TIPOS_VALIDOS: TipoEventoEmbudo[] = ['MOVIMIENTO', 'CREACION', 'EDICION', 'ELIMINACION', 'REACTIVACION']

function buildWhere(sp: URLSearchParams): Prisma.HistorialEmbudoWhereInput {
  const q = sp.get('q')?.trim()
  const tipo = sp.get('tipo')?.trim() as TipoEventoEmbudo | undefined
  const vendedor = sp.get('vendedor')?.trim()
  const incluirInactivos = sp.get('incluirInactivos') === 'true'

  const where: Prisma.HistorialEmbudoWhereInput = {}

  if (tipo && TIPOS_VALIDOS.includes(tipo)) {
    where.tipo = tipo
  }

  const negocioWhere: Prisma.NegocioEmbudoWhereInput = {}
  if (vendedor) negocioWhere.vendedor = vendedor
  if (!incluirInactivos) negocioWhere.activo = true
  if (Object.keys(negocioWhere).length > 0) {
    where.negocio = negocioWhere
  }

  if (q) {
    const num = parseInt(q, 10)
    where.OR = [
      { notas: { contains: q, mode: 'insensitive' } },
      { negocio: { nombre: { contains: q, mode: 'insensitive' } } },
      { negocio: { cliente: { contains: q, mode: 'insensitive' } } },
      ...(Number.isFinite(num) ? [{ negocio: { numero: num } }] : []),
      { usuario: { nombre: { contains: q, mode: 'insensitive' } } },
    ]
  }

  return where
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission('crm.read')
    const sp = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') ?? '20', 10) || 20))
    const where = buildWhere(sp)

    const result = await listarSeguimientoAgrupado({ where, page, limit })

    return NextResponse.json(plain(result))
  } catch (error) {
    return handleApiError(error)
  }
}
