import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('cobranzas.read')
    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId')?.trim() ?? ''
    const referencia = searchParams.get('referencia')?.trim() ?? ''
    const fechaDesde = searchParams.get('fechaDesde')?.trim() ?? ''
    const fechaHasta = searchParams.get('fechaHasta')?.trim() ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? 25)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (clienteId) where.clienteId = clienteId
    if (referencia) {
      where.referencia = { contains: referencia, mode: 'insensitive' }
    }
    if (fechaDesde || fechaHasta) {
      const fecha: Record<string, Date> = {}
      if (fechaDesde) {
        const d = new Date(fechaDesde)
        d.setHours(0, 0, 0, 0)
        fecha.gte = d
      }
      if (fechaHasta) {
        const d = new Date(fechaHasta)
        d.setHours(23, 59, 59, 999)
        fecha.lte = d
      }
      where.fecha = fecha
    }

    const [total, pagos] = await Promise.all([
      prisma.pago.count({ where }),
      prisma.pago.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
        include: {
          cliente: { select: { id: true, nombre: true } },
          imputaciones: {
            include: { factura: { select: { numero: true } } },
          },
        },
      }),
    ])

    const pagoIds = pagos.map((p) => p.id)
    const auditLogs = pagoIds.length
      ? await prisma.auditLog.findMany({
          where: {
            accion: 'cobranza.register',
            entidad: 'Pago',
            entidadId: { in: pagoIds },
          },
          select: { entidadId: true, usuarioId: true },
          orderBy: { fecha: 'asc' },
        })
      : []

    const usuarioIds = [...new Set(auditLogs.map((l) => l.usuarioId).filter(Boolean))] as string[]
    const usuarios = usuarioIds.length
      ? await prisma.usuario.findMany({
          where: { id: { in: usuarioIds } },
          select: { id: true, nombre: true },
        })
      : []
    const usuarioMap = new Map(usuarios.map((u) => [u.id, u]))
    const registradoPorMap = new Map<string, { id: string; nombre: string }>()
    for (const log of auditLogs) {
      if (log.entidadId && log.usuarioId && !registradoPorMap.has(log.entidadId)) {
        const u = usuarioMap.get(log.usuarioId)
        if (u) registradoPorMap.set(log.entidadId, u)
      }
    }

    const data = pagos.map((p) => ({
      ...p,
      registradoPor: registradoPorMap.get(p.id) ?? null,
    }))

    return NextResponse.json(
      plain({
        pagos: data,
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      }),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
