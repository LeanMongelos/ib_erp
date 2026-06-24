/**
 * Marca como VENCIDO todo presupuesto ENVIADO/APROBADO cuya fechaVencimiento ya pasó.
 * Idempotente: cron, script VPS y listados comparten esta función.
 */

import { prisma } from '@/lib/prisma'
import { criterioPresupuestosVencidos } from '@/lib/presupuestos/vencimiento'

export async function actualizarPresupuestosVencidos(): Promise<number> {
  const result = await prisma.presupuesto.updateMany({
    where: criterioPresupuestosVencidos(),
    data: { estado: 'VENCIDO' },
  })

  return result.count
}
