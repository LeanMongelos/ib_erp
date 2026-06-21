import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { proveedorUpdateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('proveedores.read')
    const { id } = await params

    const proveedor = await prisma.proveedor.findUnique({
      where: { id },
      include: {
        contactos: { orderBy: [{ principal: 'desc' }, { nombre: 'asc' }] },
        condiciones: { orderBy: { plazoDias: 'asc' } },
        productos: {
          orderBy: { vigenteDesde: 'desc' },
          include: { inventario: { select: { id: true, nombre: true, sku: true } } },
        },
      },
    })
    if (!proveedor) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(proveedor)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('proveedores.update')
    const { id } = await params

    const body = await req.json()
    const data = proveedorUpdateSchema.parse(body)
    const { contactos, condiciones, productos, ...base } = data

    // Las entidades de apoyo, si vienen, reemplazan el set actual (estrategia simple).
    const proveedor = await prisma.$transaction(async (tx) => {
      const updated = await tx.proveedor.update({
        where: { id },
        data: { ...base, ...(base.email !== undefined && { email: base.email || null }) },
      })

      if (contactos) {
        await tx.contactoProveedor.deleteMany({ where: { proveedorId: id } })
        if (contactos.length) {
          await tx.contactoProveedor.createMany({
            data: contactos.map((c) => ({ ...c, email: c.email || null, proveedorId: id })),
          })
        }
      }
      if (condiciones) {
        await tx.condicionComercialProveedor.deleteMany({ where: { proveedorId: id } })
        if (condiciones.length) {
          await tx.condicionComercialProveedor.createMany({
            data: condiciones.map((c) => ({ ...c, proveedorId: id })),
          })
        }
      }
      if (productos) {
        await tx.proveedorProducto.deleteMany({ where: { proveedorId: id } })
        if (productos.length) {
          await tx.proveedorProducto.createMany({
            data: productos.map((p) => ({ ...p, inventarioId: p.inventarioId || null, proveedorId: id })),
          })
        }
      }
      return updated
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'proveedor.update',
      entidad: 'Proveedor',
      entidadId: id,
      despues: base,
      ip: getIp(req),
    })

    return NextResponse.json(proveedor)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('proveedores.deactivate')
    const { id } = await params

    // Baja lógica para conservar el histórico de precios y condiciones.
    await prisma.proveedor.update({ where: { id }, data: { activo: false } })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'proveedor.deactivate',
      entidad: 'Proveedor',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
