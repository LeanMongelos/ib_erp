import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plantillaOcCreateSchema, plantillaOcUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

const include = {
  proveedor: { select: { id: true, razonSocial: true } },
  items: true,
} as const

export async function GET() {
  try {
    await requirePermission('compras.read')
    const plantillas = await prisma.plantillaOC.findMany({
      orderBy: { nombre: 'asc' },
      include: include,
    })
    return NextResponse.json(plain(plantillas))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.create')
    const data = plantillaOcCreateSchema.parse(await req.json())

    const proveedor = await prisma.proveedor.findFirst({
      where: { id: data.proveedorId, activo: true },
    })
    if (!proveedor) throw new ApiError(404, 'Proveedor no encontrado o inactivo')

    const created = await prisma.plantillaOC.create({
      data: {
        nombre: data.nombre,
        clasificacionOrigen: data.clasificacionOrigen,
        proveedorId: data.proveedorId,
        descripcionDefault: data.descripcionDefault ?? null,
        justificacionDefault: data.justificacionDefault ?? null,
        moneda: data.moneda ?? proveedor.moneda,
        activa: data.activa ?? true,
        recordatorioDiaMes: data.recordatorioDiaMes ?? null,
        items: {
          create: data.items.map((i) => ({
            descripcion: i.descripcion,
            concepto: i.concepto ?? null,
            cantidad: i.cantidad,
            precioUnit: i.precioUnit,
            inventarioId: i.inventarioId ?? null,
          })),
        },
      },
      include: include,
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'plantilla_oc.create',
      entidad: 'PlantillaOC',
      entidadId: created.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(created), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.create')
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')?.trim()
    if (!id) throw new ApiError(400, 'Falta id de plantilla')

    const data = plantillaOcUpdateSchema.parse(await req.json())
    const actual = await prisma.plantillaOC.findUnique({ where: { id } })
    if (!actual) throw new ApiError(404, 'Plantilla no encontrada')

    const updated = await prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.plantillaOCItem.deleteMany({ where: { plantillaId: id } })
      }
      return tx.plantillaOC.update({
        where: { id },
        data: {
          ...(data.nombre !== undefined && { nombre: data.nombre }),
          ...(data.clasificacionOrigen !== undefined && { clasificacionOrigen: data.clasificacionOrigen }),
          ...(data.proveedorId !== undefined && { proveedorId: data.proveedorId }),
          ...(data.descripcionDefault !== undefined && { descripcionDefault: data.descripcionDefault }),
          ...(data.justificacionDefault !== undefined && { justificacionDefault: data.justificacionDefault }),
          ...(data.moneda !== undefined && { moneda: data.moneda }),
          ...(data.activa !== undefined && { activa: data.activa }),
          ...(data.recordatorioDiaMes !== undefined && { recordatorioDiaMes: data.recordatorioDiaMes }),
          ...(data.items && {
            items: {
              create: data.items.map((i) => ({
                descripcion: i.descripcion,
                concepto: i.concepto ?? null,
                cantidad: i.cantidad,
                precioUnit: i.precioUnit,
                inventarioId: i.inventarioId ?? null,
              })),
            },
          }),
        },
        include: include,
      })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'plantilla_oc.update',
      entidad: 'PlantillaOC',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(updated))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.create')
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')?.trim()
    if (!id) throw new ApiError(400, 'Falta id de plantilla')

    const actual = await prisma.plantillaOC.findUnique({ where: { id } })
    if (!actual) throw new ApiError(404, 'Plantilla no encontrada')

    await prisma.plantillaOC.update({
      where: { id },
      data: { activa: false },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'plantilla_oc.deactivate',
      entidad: 'PlantillaOC',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
