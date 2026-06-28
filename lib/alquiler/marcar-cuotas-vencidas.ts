import { prisma } from '@/lib/prisma'

export async function marcarCuotasAlquilerVencidas(ahora = new Date()) {
  const result = await prisma.cuotaAlquiler.updateMany({
    where: {
      estado: { in: ['PENDIENTE', 'FACTURADA'] },
      vencimiento: { lt: ahora },
    },
    data: { estado: 'VENCIDA' },
  })
  return result.count
}
