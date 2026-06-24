import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { LOG_RETENTION_DAYS, diaLocal } from '@/lib/error-log'
import { buildLogsWhere, parseLogsFilterParams } from '@/lib/logs-export'
import { NivelLog } from '@prisma/client'

const NIVELES = Object.values(NivelLog)

export async function GET(req: NextRequest) {
  try {
    await requirePermission('logs.read')
    const { searchParams } = new URL(req.url)
    const filterParams = parseLogsFilterParams(searchParams)
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? 40)))
    const skip = (page - 1) * limit

    const desde = new Date()
    desde.setDate(desde.getDate() - LOG_RETENTION_DAYS)
    desde.setHours(0, 0, 0, 0)

    const where = buildLogsWhere(filterParams)

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
