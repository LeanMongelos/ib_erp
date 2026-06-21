import { prisma } from '@/lib/prisma'
import type { inventarioKitItemSchema } from '@/lib/validation'
import type { z } from 'zod'

type KitInput = z.infer<typeof inventarioKitItemSchema>

export async function sincronizarKitInventario(inventarioPadreId: string, items: KitInput[]) {
  await prisma.inventarioKitItem.deleteMany({ where: { inventarioPadreId } })
  if (items.length === 0) return
  await prisma.inventarioKitItem.createMany({
    data: items.map((k, idx) => ({
      inventarioPadreId,
      inventarioHijoId: k.inventarioHijoId ?? null,
      nombre: k.nombre,
      tipoItem: k.tipoItem,
      tipoComponente: k.tipoComponente ?? null,
      obligatorio: k.obligatorio ?? false,
      cantidad: k.cantidad ?? 1,
      mesesVencimiento: k.mesesVencimiento ?? null,
      notas: k.notas ?? null,
      orden: k.orden ?? idx,
    })),
  })
}
