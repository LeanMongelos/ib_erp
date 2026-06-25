/**
 * Marca como VENCIDO todo plan PROGRAMADO/PENDIENTE cuyo proximoServicio ya pasó.
 * Idempotente: cron y scripts comparten esta función.
 */

import { prisma } from '@/lib/prisma'
import { criterioPlanesMantenimientoVencidos } from '@/lib/mantenimiento/vencimiento'

export async function actualizarPlanesMantenimientoVencidos(): Promise<number> {
  const result = await prisma.planMantenimiento.updateMany({
    where: criterioPlanesMantenimientoVencidos(),
    data: { estado: 'VENCIDO' },
  })

  return result.count
}
