import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { APROBADORES_OC_EMAILS } from '@/lib/compras/oc-workflow/constants'

type Db = Prisma.TransactionClient | typeof prisma

export async function obtenerAprobadoresOC(db: Db = prisma) {
  const porEmail = await db.usuario.findMany({
    where: {
      activo: true,
      email: { in: [...APROBADORES_OC_EMAILS] },
    },
    select: { id: true, nombre: true, email: true },
  })

  if (porEmail.length > 0) {
    const order = new Map(APROBADORES_OC_EMAILS.map((e, i) => [e, i]))
    return porEmail.sort(
      (a, b) => (order.get(a.email as typeof APROBADORES_OC_EMAILS[number]) ?? 99)
        - (order.get(b.email as typeof APROBADORES_OC_EMAILS[number]) ?? 99),
    )
  }

  return db.usuario.findMany({
    where: {
      activo: true,
      roles: {
        some: {
          rol: {
            permisos: { some: { permiso: { clave: 'compras.approve' } } },
          },
        },
      },
    },
    select: { id: true, nombre: true, email: true },
    take: 10,
  })
}
