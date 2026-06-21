import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { inventarioUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { sincronizarKitInventario } from '@/lib/inventario-kit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('inventario.update')
    const { id } = await params
    const data = inventarioUpdateSchema.parse(await req.json())

    const existe = await prisma.inventario.findUnique({ where: { id } })
    if (!existe) throw new ApiError(404, 'Producto no encontrado')

    if (data.sku?.trim()) {
      const otro = await prisma.inventario.findFirst({
        where: { sku: data.sku.trim(), id: { not: id } },
      })
      if (otro) throw new ApiError(400, 'Ya existe otro producto con ese SKU')
    }

    const { stock: _stock, kitItems, ...resto } = data
    const item = await prisma.inventario.update({
      where: { id },
      data: {
        ...resto,
        sku: data.sku !== undefined ? (data.sku?.trim() || null) : undefined,
      },
      include: {
        alicuotaIva: { select: { id: true, porcentaje: true, nombre: true } },
        kitComoEquipo: { orderBy: { orden: 'asc' }, include: { hijo: { select: { id: true, nombre: true, sku: true } } } },
      },
    })

    if (kitItems !== undefined) {
      await sincronizarKitInventario(id, kitItems)
    }

    const conKit = await prisma.inventario.findUnique({
      where: { id },
      include: {
        alicuotaIva: { select: { id: true, porcentaje: true, nombre: true } },
        kitComoEquipo: { orderBy: { orden: 'asc' }, include: { hijo: { select: { id: true, nombre: true, sku: true } } } },
      },
    })

    return NextResponse.json(plain(conKit ?? item))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('inventario.update')
    const { id } = await params

    const item = await prisma.inventario.update({
      where: { id },
      data: { activo: false },
    })
    return NextResponse.json(plain(item))
  } catch (error) {
    return handleApiError(error)
  }
}
