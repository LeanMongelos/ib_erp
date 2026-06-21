import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'

type ItemFacturaInput = {
  descripcion: string
  inventarioId?: string | null
  sucursalInstalacionId?: string | null
}

/** Exige sucursal de instalación en ítems de tipo EQUIPO y valida pertenencia al cliente. */
export async function validarSucursalesInstalacionEquipo(
  clienteId: string,
  items: ItemFacturaInput[],
): Promise<void> {
  const inventarioIds = items
    .map((i) => i.inventarioId)
    .filter((id): id is string => Boolean(id))

  if (inventarioIds.length === 0) return

  const inventarios = await prisma.inventario.findMany({
    where: { id: { in: inventarioIds } },
    select: { id: true, tipoArticulo: true, nombre: true },
  })
  const porId = new Map(inventarios.map((inv) => [inv.id, inv]))

  for (const item of items) {
    if (!item.inventarioId) continue
    const inv = porId.get(item.inventarioId)
    if (inv?.tipoArticulo !== 'EQUIPO') continue

    if (!item.sucursalInstalacionId) {
      throw new ApiError(
        400,
        `«${item.descripcion}»: seleccioná la sucursal de instalación para ubicar el equipo en el mapa`,
      )
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
      throw new ApiError(400, `La sucursal de instalación no pertenece al cliente seleccionado`)
    }
  }
}
