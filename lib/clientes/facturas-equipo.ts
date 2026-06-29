/**
 * Facturas de un cliente vinculadas a un equipo específico (por serie / ítem origen).
 */
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'

export async function facturasPorEquipoCliente(clienteId: string, equipoId: string) {
  const equipo = await prisma.equipo.findFirst({
    where: { id: equipoId, clienteId },
    select: { id: true, numeroSerie: true, inventarioId: true, nombre: true },
  })
  if (!equipo) throw new ApiError(404, 'Equipo no encontrado')

  const condiciones: Array<Record<string, unknown>> = [{ equipoGeneradoId: equipoId }]
  if (equipo.numeroSerie) {
    condiciones.push({ numeroSerie: equipo.numeroSerie })
  }
  if (equipo.inventarioId && equipo.numeroSerie) {
    condiciones.push({ inventarioId: equipo.inventarioId, numeroSerie: equipo.numeroSerie })
  }

  return prisma.factura.findMany({
    where: {
      clienteId,
      estado: { not: 'ANULADA' },
      items: { some: { OR: condiciones } },
    },
    orderBy: { fechaEmision: 'desc' },
    include: {
      items: {
        where: { OR: condiciones },
        select: {
          id: true,
          descripcion: true,
          cantidad: true,
          precioUnit: true,
          subtotal: true,
          numeroSerie: true,
          codigo: true,
        },
      },
    },
  })
}
