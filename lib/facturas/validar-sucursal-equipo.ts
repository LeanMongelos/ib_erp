import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import {
  esItemEquipoInstalacion,
  mensajeSucursalInstalacionFaltante,
  type ItemEquipoInstalacion,
} from '@/lib/facturas/equipo-instalacion-client'

type ItemFacturaInput = ItemEquipoInstalacion

/** Exige sucursal de instalación en ítems de tipo EQUIPO y valida pertenencia al cliente. */
export async function validarSucursalesInstalacionEquipo(
  clienteId: string,
  items: ItemFacturaInput[],
): Promise<void> {
  const inventarioIds = items
    .map((i) => i.inventarioId)
    .filter((id): id is string => Boolean(id))

  const tipoPorInventario = new Map<string, string>()
  if (inventarioIds.length > 0) {
    const inventarios = await prisma.inventario.findMany({
      where: { id: { in: inventarioIds } },
      select: { id: true, tipoArticulo: true },
    })
    for (const inv of inventarios) {
      tipoPorInventario.set(inv.id, inv.tipoArticulo)
    }
  }

  for (const item of items) {
    const tipoResuelto =
      item.tipoArticulo ??
      (item.inventarioId ? tipoPorInventario.get(item.inventarioId) : undefined)

    if (!esItemEquipoInstalacion({ tipoArticulo: tipoResuelto })) continue

    if (!item.sucursalInstalacionId) {
      throw new ApiError(400, mensajeSucursalInstalacionFaltante(item.descripcion))
    }

    const sucursal = await prisma.clienteSucursal.findFirst({
      where: {
        id: item.sucursalInstalacionId,
        clienteId,
        activo: true,
      },
      select: { id: true },
    })
    if (!sucursal) {
      throw new ApiError(400, 'La sucursal de instalación no pertenece al cliente seleccionado')
    }
  }
}
