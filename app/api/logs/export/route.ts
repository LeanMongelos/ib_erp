import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import {
  buildLogsWhere,
  LOGS_EXPORT_MAX,
  nombreArchivoLogsExport,
  parseLogsFilterParams,
  systemLogsToXlsx,
} from '@/lib/logs-export'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('logs.read')

    const params = parseLogsFilterParams(new URL(req.url).searchParams)
    const where = buildLogsWhere(params)

    const total = await prisma.systemLog.count({ where })
    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: LOGS_EXPORT_MAX,
    })

    const usuarioIds = [...new Set(logs.map((l) => l.usuarioId).filter(Boolean))] as string[]
    const usuarios =
      usuarioIds.length > 0
        ? await prisma.usuario.findMany({
            where: { id: { in: usuarioIds } },
            select: { id: true, nombre: true, email: true },
          })
        : []
    const usuarioMap = new Map(usuarios.map((u) => [u.id, u]))

    const enriched = logs.map((l) => ({
      ...l,
      usuario: l.usuarioId ? usuarioMap.get(l.usuarioId) ?? null : null,
    }))

    const buffer = systemLogsToXlsx(enriched, {
      totalFiltrados: total,
      exportados: enriched.length,
    })
    const filename = nombreArchivoLogsExport(params)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error, { req, origen: 'api', ruta: '/api/logs/export' })
  }
}
