import type { Prisma, TipoEventoOC } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Db = Prisma.TransactionClient | typeof prisma

export interface RegistrarEventoOCInput {
  ordenCompraId: string
  tipo: TipoEventoOC
  usuarioId?: string | null
  referencia?: string | null
  payload?: Prisma.InputJsonValue
  fecha?: Date
}

export async function registrarEventoOC(input: RegistrarEventoOCInput, db: Db = prisma) {
  return db.eventoOrdenCompra.create({
    data: {
      ordenCompraId: input.ordenCompraId,
      tipo: input.tipo,
      usuarioId: input.usuarioId ?? null,
      referencia: input.referencia ?? null,
      payload: input.payload ?? undefined,
      fecha: input.fecha ?? new Date(),
    },
  })
}
