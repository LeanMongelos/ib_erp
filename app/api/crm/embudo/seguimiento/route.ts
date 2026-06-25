import { NextRequest, NextResponse } from 'next/server'
import type { Prisma, TipoEventoEmbudo } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { mapEventoEmbudoDTO } from '@/lib/crm/embudo-historial'

const TIPOS_VALIDOS: TipoEventoEmbudo[] = ['MOVIMIENTO', 'CREACION', 'EDICION', 'ELIMINACION', 'REACTIVACION']

export async function GET(req: NextRequest) {
  try {
    await requirePermission('crm.read')
    const sp = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '40', 10) || 40))
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

    const [total, rows] = await Promise.all([
      prisma.historialEmbudo.count({ where }),
      prisma.historialEmbudo.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          usuario: { select: { id: true, nombre: true } },
          negocio: {
            select: {
              id: true,
              numero: true,
              nombre: true,
              cliente: true,
              vendedor: true,
              etapa: true,
              activo: true,
            },
          },
        },
      }),
    ])

    const items = rows.map((h) => mapEventoEmbudoDTO(h))
    const pages = Math.max(1, Math.ceil(total / limit))

    return NextResponse.json(plain({
      items,
      total,
      page,
      pages,
      limit,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}
