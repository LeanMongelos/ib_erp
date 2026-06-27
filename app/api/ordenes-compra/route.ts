import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { ordenCompraCreateSchema, estadoOrdenCompraEnum, tipoCompraProveedorEnum } from '@/lib/validation'
import { siguienteNumeroOC, crearConNumeroUnico } from '@/lib/sequences'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { registrarOcCreada } from '@/lib/compras/oc-workflow/aprobacion'
import { calcularTotalesOC, filtroProveedorPorTipoCompra } from '@/lib/compras/oc'
import { mapOcHeaderFields, mapOcItemsCreate, resolverCotizacionUsd } from '@/lib/compras/oc-crud'
import { ocInclude } from '@/lib/compras/oc-include'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('compras.read')
    const { searchParams } = new URL(req.url)
    const estadoRaw = searchParams.get('estado') ?? ''
    const proveedorId = searchParams.get('proveedorId')?.trim() ?? ''
    const tipoCompraRaw = searchParams.get('tipoCompra') ?? ''

    const estado = estadoOrdenCompraEnum.safeParse(estadoRaw).success ? estadoRaw : ''
    const tipoCompra = tipoCompraProveedorEnum.safeParse(tipoCompraRaw).success ? tipoCompraRaw : ''

    const ordenes = await prisma.ordenCompra.findMany({
      where: {
        ...(estado && { estado: estado as Prisma.EnumEstadoOrdenCompraFilter['equals'] }),
        ...(proveedorId && { proveedorId }),
        ...(tipoCompra && {
          proveedor: filtroProveedorPorTipoCompra(tipoCompra as 'REMITO' | 'CONCEPTOS' | 'AMBOS'),
        }),
      },
      orderBy: { creadoEn: 'desc' },
      include: ocInclude,
    })
    return NextResponse.json(plain(ordenes))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.create')
    const data = ordenCompraCreateSchema.parse(await req.json())
    const { itemsCalc, subtotal, total } = calcularTotalesOC(data.items)

    const proveedor = await prisma.proveedor.findFirst({
      where: { id: data.proveedorId, activo: true },
    })
    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado o inactivo' }, { status: 404 })
    }

    const moneda = data.moneda ?? proveedor.moneda
    const cotizacionUsd = await resolverCotizacionUsd(moneda, data.cotizacionUsd)

    const oc = await crearConNumeroUnico(
      siguienteNumeroOC,
      (numero) =>
        prisma.ordenCompra.create({
          data: {
            numero,
            ...mapOcHeaderFields(data),
            moneda,
            cotizacionUsd,
            subtotal,
            total,
            estado: 'BORRADOR',
            creadoPorId: actor.id,
            items: {
              create: mapOcItemsCreate(data, itemsCalc),
            },
          },
          include: ocInclude,
        }),
    )

    await registrarOcCreada(oc.id, actor.id, oc.numero)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'oc.create',
      entidad: 'OrdenCompra',
      entidadId: oc.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(oc), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
