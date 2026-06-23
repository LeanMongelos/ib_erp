import { NextRequest, NextResponse } from 'next/server'
import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { LOG_RETENTION_DAYS, diaLocal, rangoDiaLocal } from '@/lib/error-log'

const NIVELES = Object.values(NivelLog)

export async function GET(req: NextRequest) {
  try {
    await requirePermission('logs.read')
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const nivel = searchParams.get('nivel')?.trim() ?? ''
    const origen = searchParams.get('origen')?.trim() ?? ''
    const usuarioId = searchParams.get('usuarioId')?.trim() ?? ''
    const dia = searchParams.get('dia')?.trim() ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? 40)))
    const skip = (page - 1) * limit

    const desde = new Date()
    desde.setDate(desde.getDate() - LOG_RETENTION_DAYS)
    desde.setHours(0, 0, 0, 0)

    const where: Record<string, unknown> = { fecha: { gte: desde } }
    if (NIVELES.includes(nivel as NivelLog)) where.nivel = nivel
    if (origen) where.origen = origen
    if (usuarioId) where.usuarioId = usuarioId
    if (dia) where.fecha = rangoDiaLocal(dia)
    if (q) {
      where.OR = [
        { mensaje: { contains: q, mode: 'insensitive' } },
        { ruta: { contains: q, mode: 'insensitive' } },
        { origen: { contains: q, mode: 'insensitive' } },
        { stack: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, logs, usuarios, origenes, recientes] = await Promise.all([
      prisma.systemLog.count({ where }),
      prisma.systemLog.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      prisma.usuario.findMany({
        select: { id: true, nombre: true, email: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.systemLog.findMany({
        where: { fecha: { gte: desde } },
        distinct: ['origen'],
        select: { origen: true },
        orderBy: { origen: 'asc' },
      }),
      prisma.systemLog.findMany({
        where: { fecha: { gte: desde } },
        select: { fecha: true },
        orderBy: { fecha: 'desc' },
        take: 5000,
      }),
    ])

    const resumenPorDia = new Map<string, number>()
    for (const r of recientes) {
      const d = diaLocal(new Date(r.fecha))
      resumenPorDia.set(d, (resumenPorDia.get(d) ?? 0) + 1)
    }
    const dias: { dia: string; total: number }[] = []
    for (let i = 0; i < LOG_RETENTION_DAYS; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = diaLocal(d)
      dias.push({ dia: key, total: resumenPorDia.get(key) ?? 0 })
    }

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
        retencionDias: LOG_RETENTION_DAYS,
        filtros: {
          usuarios,
          origenes: origenes.map((o) => o.origen),
          niveles: NIVELES,
          dias,
        },
      }),
    )
  } catch (error) {
    return handleApiError(error, { req, origen: 'api', ruta: '/api/logs' })
  }
}
