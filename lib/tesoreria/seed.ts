import type { PrismaClient } from '@prisma/client'

/** Cuentas demo de tesorería (solo si no existen). */
export async function seedCuentasTesoreria(prisma: PrismaClient) {
  const count = await prisma.cuentaTesoreria.count()
  if (count > 0) return 0

  const planCaja = await prisma.planCuenta.findUnique({ where: { codigo: '1.1.01' } })

  await prisma.cuentaTesoreria.createMany({
    data: [
      {
        id: 'seed-cuenta-caja',
        nombre: 'Caja chica',
        tipo: 'CAJA',
        predeterminada: true,
        planCuentaId: planCaja?.id ?? null,
      },
      {
        id: 'seed-cuenta-banco',
        nombre: 'Banco operativo',
        tipo: 'BANCO',
        banco: 'Banco Demo',
        predeterminada: true,
        planCuentaId: planCaja?.id ?? null,
      },
    ],
  })

  return 2
}
