import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { listaPreciosItemSchema, listaPreciosItemUpdateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'
import { z } from 'zod'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('listas_precios.read')
    const { id } = await params

    const lista = await prisma.listaPrecios.findUnique({ where: { id }, select: { id: true } })
    if (!lista) throw new ApiError(404, 'Lista de precios no encontrada')

    const items = await prisma.listaPreciosItem.findMany({
      where: { listaPreciosId: id },
      include: {
        inventario: {
          select: { id: true, nombre: true, sku: true, moneda: true, precioUnit: true, activo: true },
        },
      },
      orderBy: { inventario: { nombre: 'asc' } },
    })

    return NextResponse.json(plain(items))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('listas_precios.manage')
    const { id: listaPreciosId } = await params
    const data = listaPreciosItemSchema.parse(await req.json())

    const lista = await prisma.listaPrecios.findUnique({ where: { id: listaPreciosId } })
    if (!lista) throw new ApiError(404, 'Lista de precios no encontrada')

    const inventario = await prisma.inventario.findUnique({ where: { id: data.inventarioId } })
    if (!inventario) throw new ApiError(404, 'Ítem de inventario no encontrado')

    const item = await prisma.listaPreciosItem.upsert({
      where: {
        listaPreciosId_inventarioId: { listaPreciosId, inventarioId: data.inventarioId },
      },
      create: { listaPreciosId, ...data },
      update: data,
      include: {
        inventario: {
          select: { id: true, nombre: true, sku: true, moneda: true, precioUnit: true, activo: true },
        },
      },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'lista_precios.item_upsert',
      entidad: 'ListaPreciosItem',
      entidadId: item.id,
      despues: { listaPreciosId, inventarioId: data.inventarioId, precioUnit: data.precioUnit },
      ip: getIp(req),
    })

    return NextResponse.json(plain(item), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('listas_precios.manage')
    const { id: listaPreciosId } = await params
    const body = listaPreciosItemUpdateSchema.extend({ itemId: z.string().min(1) }).parse(await req.json())

    const { itemId, ...data } = body
    const existente = await prisma.listaPreciosItem.findFirst({
      where: { id: itemId, listaPreciosId },
    })
    if (!existente) throw new ApiError(404, 'Ítem de lista no encontrado')

    const item = await prisma.listaPreciosItem.update({
      where: { id: itemId },
      data,
      include: {
        inventario: {
          select: { id: true, nombre: true, sku: true, moneda: true, precioUnit: true, activo: true },
        },
      },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'lista_precios.item_update',
      entidad: 'ListaPreciosItem',
      entidadId: itemId,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(item))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('listas_precios.manage')
    const { id: listaPreciosId } = await params
    const { itemId } = z.object({ itemId: z.string().min(1) }).parse(await req.json())

    const existente = await prisma.listaPreciosItem.findFirst({
      where: { id: itemId, listaPreciosId },
    })
    if (!existente) throw new ApiError(404, 'Ítem de lista no encontrado')

    await prisma.listaPreciosItem.delete({ where: { id: itemId } })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'lista_precios.item_delete',
      entidad: 'ListaPreciosItem',
      entidadId: itemId,
      ip: getIp(req),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
