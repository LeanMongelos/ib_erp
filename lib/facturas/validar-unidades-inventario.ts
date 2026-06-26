/**
 * Valida unidades de inventario seleccionadas en ítems EQUIPO de factura.
 */
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { trazabilidadActiva } from '@/lib/inventario/unidades'

type ItemConUnidad = {
  descripcion: string
  inventarioId?: string | null
  inventarioUnidadId?: string | null
  tipoArticulo?: string | null
  numeroSerie?: string | null
}

export async function validarUnidadesInventarioFactura(items: ItemConUnidad[]) {
  for (const item of items) {
    if (item.tipoArticulo !== 'EQUIPO' || !item.inventarioId) continue

    const cat = await prisma.inventario.findUnique({
      where: { id: item.inventarioId },
      select: { id: true, nombre: true, modoTrazabilidad: true, esSerializado: true },
    })
    if (!cat) continue

    const trazabilidad = trazabilidadActiva(cat.modoTrazabilidad)

    if (trazabilidad) {
      if (!item.inventarioUnidadId) {
        throw new ApiError(
          400,
          `«${item.descripcion}»: seleccioná una unidad en stock (serie/lote) del inventario`,
        )
      }

      const unidad = await prisma.inventarioUnidad.findFirst({
        where: {
          id: item.inventarioUnidadId,
          inventarioId: cat.id,
          estado: { in: ['EN_STOCK', 'RESERVADO'] },
        },
      })
      if (!unidad) {
        throw new ApiError(400, `«${item.descripcion}»: la unidad seleccionada no está disponible`)
      }
    } else if (cat.esSerializado && !item.numeroSerie?.trim() && !item.inventarioUnidadId) {
      throw new ApiError(400, `«${item.descripcion}»: falta número de serie en la línea de factura`)
    }
  }
}
