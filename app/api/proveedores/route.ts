import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { proveedorCreateSchema, origenProveedorEnum, tipoCompraProveedorEnum } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('proveedores.read')

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('q')?.trim() ?? ''
    const origenRaw = searchParams.get('origen') ?? ''
    const tipoCompraRaw = searchParams.get('tipoCompra') ?? ''
    const origen = origenProveedorEnum.safeParse(origenRaw).success ? origenRaw : ''
    const tipoCompra = tipoCompraProveedorEnum.safeParse(tipoCompraRaw).success ? tipoCompraRaw : ''

    const proveedores = await prisma.proveedor.findMany({
      where: {
        activo: true,
        ...(search && {
          OR: [
            { razonSocial: { contains: search, mode: 'insensitive' } },
            { rubro:       { contains: search, mode: 'insensitive' } },
            { marcas:      { contains: search, mode: 'insensitive' } },
            { ciudad:      { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(origen && { origen: origen as 'NACIONAL' | 'IMPORTADO' }),
        ...(tipoCompra && tipoCompra !== 'AMBOS'
          ? { OR: [{ tipoCompra: tipoCompra as 'REMITO' | 'CONCEPTOS' }, { tipoCompra: 'AMBOS' }] }
          : tipoCompra === 'AMBOS'
            ? { tipoCompra: 'AMBOS' }
            : {}),
      },
      include: { _count: { select: { productos: true, contactos: true } } },
      orderBy: { razonSocial: 'asc' },
    })
    return NextResponse.json(proveedores)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('proveedores.create')

    const body = await req.json()
    const data = proveedorCreateSchema.parse(body)
    const { contactos, condiciones, productos, ...base } = data

    const proveedor = await prisma.proveedor.create({
      data: {
        ...base,
        email: base.email || null,
        ...(contactos?.length && {
          contactos: { create: contactos.map((c) => ({ ...c, email: c.email || null })) },
        }),
        ...(condiciones?.length && { condiciones: { create: condiciones } }),
        ...(productos?.length && {
          productos: {
            create: productos.map((p) => ({
              ...p,
              inventarioId: p.inventarioId || null,
            })),
          },
        }),
      },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'proveedor.create',
      entidad: 'Proveedor',
      entidadId: proveedor.id,
      despues: { razonSocial: proveedor.razonSocial, cuit: proveedor.cuit },
      ip: getIp(req),
    })

    return NextResponse.json(proveedor, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
