/**
 * Marca como VENCIDO todo presupuesto ENVIADO/APROBADO cuya fechaVencimiento ya pasó.
 * Idempotente: cron, script VPS y listados comparten esta función.
 */

import { prisma } from '@/lib/prisma'

export async function actualizarPresupuestosVencidos(): Promise<number> {
  const ahora = new Date()

  const result = await prisma.presupuesto.updateMany({
    where: {
      estado: { in: ['ENVIADO', 'APROBADO'] },
      fechaVencimiento: { lt: ahora },
    },
    data: { estado: 'VENCIDO' },
  })

  return result.count
}
