import { prisma } from '@/lib/prisma'

export async function getResumenAlquiler() {
  const [activos, borradores, cuotasPendientes, cuotasVencidas, montoMensualActivo] = await Promise.all([
    prisma.contratoAlquiler.count({ where: { estado: 'ACTIVO' } }),
    prisma.contratoAlquiler.count({ where: { estado: 'BORRADOR' } }),
    prisma.cuotaAlquiler.count({ where: { estado: 'PENDIENTE' } }),
    prisma.cuotaAlquiler.count({ where: { estado: 'VENCIDA' } }),
    prisma.lineaAlquiler.aggregate({
      where: { activa: true, contrato: { estado: 'ACTIVO' } },
      _sum: { montoMensual: true },
    }),
  ])

  return {
    contratosActivos: activos,
    contratosBorrador: borradores,
    cuotasPendientes,
    cuotasVencidas,
    montoMensualActivo: montoMensualActivo._sum.montoMensual ?? 0,
  }
}
