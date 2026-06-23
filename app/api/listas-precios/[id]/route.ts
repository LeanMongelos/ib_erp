import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { listaPreciosUpdateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('listas_precios.read')
    const { id } = await params
    const lista = await prisma.listaPrecios.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            inventario: {
              select: { id: true, nombre: true, sku: true, moneda: true, precioUnit: true, activo: true },
            },
          },
          orderBy: { inventario: { nombre: 'asc' } },
        },
        _count: { select: { clientes: true } },
      },
    })
    if (!lista) throw new ApiError(404, 'Lista de precios no encontrada')
    return NextResponse.json(plain(lista))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('listas_precios.manage')
    const { id } = await params
    const data = listaPreciosUpdateSchema.parse(await req.json())

    const lista = await prisma.$transaction(async (tx) => {
      const actual = await tx.listaPrecios.findUnique({ where: { id } })
      if (!actual) throw new ApiError(404, 'Lista de precios no encontrada')

      const tipo = data.tipo ?? actual.tipo
      const moneda = data.moneda ?? actual.moneda
      if (data.predeterminada) {
        await tx.listaPrecios.updateMany({
          where: { id: { not: id }, tipo, moneda, predeterminada: true },
          data: { predeterminada: false },
        })
      }

      return tx.listaPrecios.update({ where: { id }, data })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'lista_precios.update',
      entidad: 'ListaPrecios',
      entidadId: id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(lista))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('listas_precios.manage')
    const { id } = await params

    const lista = await prisma.listaPrecios.update({
      where: { id },
      data: { activo: false, predeterminada: false },
    })

    await prisma.cliente.updateMany({
      where: { listaPreciosId: id },
      data: { listaPreciosId: null },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'lista_precios.deactivate',
      entidad: 'ListaPrecios',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(lista))
  } catch (error) {
    return handleApiError(error)
  }
}
