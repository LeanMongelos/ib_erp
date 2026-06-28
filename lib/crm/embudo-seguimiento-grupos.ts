import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { mapEventoEmbudoDTO } from '@/lib/crm/embudo-historial'

export async function listarSeguimientoAgrupado(params: {
  where: Prisma.HistorialEmbudoWhereInput
  page: number
  limit: number
}) {
  const groups = await prisma.historialEmbudo.groupBy({
    by: ['negocioId'],
    where: params.where,
    _max: { creadoEn: true },
    _count: { _all: true },
  })

  groups.sort((a, b) => {
    const ta = a._max.creadoEn?.getTime() ?? 0
    const tb = b._max.creadoEn?.getTime() ?? 0
    return tb - ta
  })

  const total = groups.length
  const pages = Math.max(1, Math.ceil(total / params.limit))
  const slice = groups.slice((params.page - 1) * params.limit, params.page * params.limit)
  const negocioIds = slice.map((g) => g.negocioId)

  if (negocioIds.length === 0) {
    return { grupos: [], total, page: params.page, pages, limit: params.limit }
  }

  const [negocios, eventos] = await Promise.all([
    prisma.negocioEmbudo.findMany({
      where: { id: { in: negocioIds } },
      select: {
        id: true,
        numero: true,
        nombre: true,
        cliente: true,
        vendedor: true,
        etapa: true,
        activo: true,
      },
    }),
    prisma.historialEmbudo.findMany({
      where: { ...params.where, negocioId: { in: negocioIds } },
      orderBy: { creadoEn: 'desc' },
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

  const negocioMap = new Map(negocios.map((n) => [n.id, n]))
  const eventosByNegocio = new Map<string, typeof eventos>()
  for (const e of eventos) {
    const arr = eventosByNegocio.get(e.negocioId) ?? []
    arr.push(e)
    eventosByNegocio.set(e.negocioId, arr)
  }

  const grupos = slice
    .map((g) => {
      const negocio = negocioMap.get(g.negocioId)
      if (!negocio) return null
      const evts = (eventosByNegocio.get(g.negocioId) ?? []).map(mapEventoEmbudoDTO)
      return {
        negocio: {
          id: negocio.id,
          numero: negocio.numero,
          nombre: negocio.nombre,
          cliente: negocio.cliente,
          vendedor: negocio.vendedor,
          etapa: negocio.etapa,
          activo: negocio.activo,
        },
        totalEventos: g._count._all,
        ultimoEvento: g._max.creadoEn,
        eventos: evts,
      }
    })
    .filter(Boolean)

  return { grupos, total, page: params.page, pages, limit: params.limit }
}
