import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Tx = Prisma.TransactionClient

/** Marca cuotas de alquiler vinculadas cuando la factura queda totalmente pagada. */
export async function sincronizarCuotasAlquilerFacturaPagada(facturaId: string, tx?: Tx) {
  const db = tx ?? prisma
  await db.cuotaAlquiler.updateMany({
    where: {
      facturaId,
      estado: { in: ['FACTURADA', 'VENCIDA'] },
    },
    data: { estado: 'COBRADA' },
  })
}
