/**
 * Alertas admin recientes — WARN de SystemLog (afip-notify, integridad, cobranza).
 */

import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const ALERTAS_ORIGENES = ['afip-notify', 'integridad', 'cobranza'] as const
export const ALERTAS_DIAS = 7
export const ALERTAS_LIMITE = 20

export type AlertaReciente = {
  id: string
  origen: string
  mensaje: string
  fecha: string
  ruta: string | null
  metadata: unknown
}

function desdeAlertas(): Date {
  const d = new Date()
  d.setDate(d.getDate() - ALERTAS_DIAS)
  d.setHours(0, 0, 0, 0)
  return d
}

function whereAlertas() {
  return {
    nivel: NivelLog.WARN,
    origen: { in: [...ALERTAS_ORIGENES] },
    fecha: { gte: desdeAlertas() },
  }
}

export async function contarAlertasRecientes(): Promise<number> {
  return prisma.systemLog.count({ where: whereAlertas() })
}

export async function listarAlertasRecientes(page = 1, limit = ALERTAS_LIMITE) {
  const skip = (Math.max(1, page) - 1) * limit
  const where = whereAlertas()
  const [total, alertas] = await Promise.all([
    prisma.systemLog.count({ where }),
    prisma.systemLog.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        origen: true,
        mensaje: true,
        fecha: true,
        ruta: true,
        metadata: true,
      },
    }),
  ])

  return {
    total,
    page: Math.max(1, page),
    pages: Math.max(1, Math.ceil(total / limit)),
    alertas: alertas.map((a) => ({
      ...a,
      fecha: a.fecha.toISOString(),
    })) satisfies AlertaReciente[],
  }
}
