import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('auditoria.read')
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const entidad = searchParams.get('entidad')?.trim() ?? ''
    const accion = searchParams.get('accion')?.trim() ?? ''
    const usuarioId = searchParams.get('usuarioId')?.trim() ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? 40)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (entidad) where.entidad = entidad
    if (accion) where.accion = { contains: accion, mode: 'insensitive' }
    if (usuarioId) where.usuarioId = usuarioId
    if (q) {
      where.OR = [
        { accion: { contains: q, mode: 'insensitive' } },
        { entidad: { contains: q, mode: 'insensitive' } },
        { entidadId: { contains: q, mode: 'insensitive' } },
        { ip: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, logs, usuarios, entidades] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      prisma.usuario.findMany({
        select: { id: true, nombre: true, email: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.auditLog.findMany({
        distinct: ['entidad'],
        select: { entidad: true },
        orderBy: { entidad: 'asc' },
      }),
    ])

    const usuarioMap = new Map(usuarios.map((u) => [u.id, u]))
    const enriched = logs.map((l) => ({
      ...l,
      usuario: l.usuarioId ? usuarioMap.get(l.usuarioId) ?? null : null,
    }))

    return NextResponse.json(
      plain({
        logs: enriched,
        total,
        page,
        pages: Math.ceil(total / limit),
        filtros: {
          usuarios,
          entidades: entidades.map((e) => e.entidad),
        },
      }),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
