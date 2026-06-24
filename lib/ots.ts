/**
 * lib/ots.ts
 * Lógica de dominio de las Órdenes de Trabajo que debe ejecutarse del lado
 * del servidor.
 *
 * `actualizarOTsVencidas` marca como VENCIDA toda OT abierta o en proceso cuyo
 * SLA ya expiró, dejando además una entrada en el historial. Idempotente: solo
 * procesa ABIERTA/EN_PROCESO; cron, script VPS y listados comparten esta función.
 */

import { prisma } from '@/lib/prisma'

export async function actualizarOTsVencidas(): Promise<number> {
  const ahora = new Date()

  const vencidas = await prisma.ordenTrabajo.findMany({
    where: {
      estado: { in: ['ABIERTA', 'EN_PROCESO'] },
      slaVence: { lt: ahora },
    },
    select: { id: true },
  })

  if (vencidas.length === 0) return 0

  const ids = vencidas.map((o) => o.id)

  await prisma.$transaction([
    prisma.ordenTrabajo.updateMany({
      where: { id: { in: ids } },
      data: { estado: 'VENCIDA' },
    }),
    prisma.historialOT.createMany({
      data: ids.map((otId) => ({
        otId,
        estado: 'VENCIDA' as const,
        nota: 'SLA vencido — marcada automáticamente por el sistema',
      })),
    }),
  ])

  return ids.length
}
