import { prisma } from '@/lib/prisma'

/** ID fijo en seed — cliente genérico para presupuestos rápidos (Consumidor Final). */
export const CLIENTE_EVENTUAL_ID = 'cliente-eventual'
export const CLIENTE_EVENTUAL_NOMBRE = 'Cliente Eventual'

export async function ensureClienteEventual() {
  return prisma.cliente.upsert({
    where: { id: CLIENTE_EVENTUAL_ID },
    create: {
      id: CLIENTE_EVENTUAL_ID,
      nombre: CLIENTE_EVENTUAL_NOMBRE,
      tipo: 'OTRO',
      condicionIva: 'Consumidor Final',
      notas: 'Cliente genérico para presupuestos y ventas ocasionales sin ficha completa.',
    },
    update: {
      activo: true,
      nombre: CLIENTE_EVENTUAL_NOMBRE,
    },
  })
}

export function isClienteEventual(cliente: { id: string; nombre?: string }): boolean {
  return cliente.id === CLIENTE_EVENTUAL_ID || cliente.nombre === CLIENTE_EVENTUAL_NOMBRE
}

/** Ordena clientes poniendo Cliente Eventual primero. */
export function ordenarClientesConEventual<T extends { id: string; nombre: string }>(
  clientes: T[],
  eventualId: string,
): T[] {
  const eventual = clientes.find((c) => c.id === eventualId)
  const resto = clientes.filter((c) => c.id !== eventualId).sort((a, b) => a.nombre.localeCompare(b.nombre))
  return eventual ? [eventual, ...resto] : resto
}
