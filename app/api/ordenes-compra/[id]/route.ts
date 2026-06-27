import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { ordenCompraUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { calcularTotalesOC, ocEsEditable } from '@/lib/compras/oc'
import { mapOcHeaderFields, mapOcItemsCreate, resolverCotizacionUsd } from '@/lib/compras/oc-crud'
import { ocInclude } from '@/lib/compras/oc-include'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('compras.read')
    const { id } = await params

    const oc = await prisma.ordenCompra.findUnique({
      where: { id },
      include: ocInclude,
    })
    if (!oc) throw new ApiError(404, 'Orden de compra no encontrada')

    return NextResponse.json(plain(oc))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.create')
    const { id } = await params
    const data = ordenCompraUpdateSchema.parse(await req.json())

    const actual = await prisma.ordenCompra.findUnique({ where: { id } })
    if (!actual) throw new ApiError(404, 'Orden de compra no encontrada')
    if (!ocEsEditable(actual.estado)) {
      throw new ApiError(400, `Solo se editan OC en borrador o rechazadas (actual: ${actual.estado})`)
    }

    const proveedor = await prisma.proveedor.findFirst({
      where: { id: data.proveedorId, activo: true },
    })
    if (!proveedor) throw new ApiError(404, 'Proveedor no encontrado o inactivo')

    const { itemsCalc, subtotal, total } = calcularTotalesOC(data.items)
    const moneda = data.moneda ?? proveedor.moneda
    const cotizacionUsd = await resolverCotizacionUsd(moneda, data.cotizacionUsd)

    const updated = await prisma.$transaction(async (tx) => {
      await tx.itemOrdenCompra.deleteMany({ where: { ordenCompraId: id } })
      return tx.ordenCompra.update({
        where: { id },
        data: {
          ...mapOcHeaderFields(data),
          moneda,
          cotizacionUsd,
          subtotal,
          total,
          estado: 'BORRADOR',
          enviadaAprobacionEn: null,
          aprobadoPorId: null,
          aprobadoEn: null,
          rechazadoPorId: null,
          rechazadoEn: null,
          rechazadoMotivo: null,
          items: {
            create: mapOcItemsCreate(data, itemsCalc),
          },
        },
        include: ocInclude,
      })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.update',
      entidad: 'OrdenCompra',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(updated))
  } catch (error) {
    return handleApiError(error)
  }
}
