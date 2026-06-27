import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { inventarioCreateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarMovimientoStock } from '@/lib/inventario'
import { sincronizarKitInventario } from '@/lib/inventario-kit'
import { trazabilidadActiva } from '@/lib/inventario/unidades'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('inventario.read')
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)

    const items = await prisma.inventario.findMany({
      where: {
        activo: true,
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
                { categoria: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        alicuotaIva: { select: { id: true, porcentaje: true, nombre: true } },
        kitComoEquipo: { orderBy: { orden: 'asc' }, include: { hijo: { select: { id: true, nombre: true, sku: true } } } },
      },
      orderBy: { nombre: 'asc' },
      take: q ? limit : undefined,
    })
    return NextResponse.json(plain(items))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('inventario.create')

    const body = await req.json()
    const data = inventarioCreateSchema.parse(body)
    const { kitItems, stock: stockInicial, ...resto } = data
    const esEquipo = resto.tipoArticulo === 'EQUIPO'

    const item = await prisma.inventario.create({
      data: {
        ...resto,
        nombre: resto.nombre,
        descripcion: resto.descripcion ?? null,
        sku: resto.sku,
        marca: resto.marca ?? null,
        modelo: resto.modelo ?? null,
        esSerializado: esEquipo ? (resto.esSerializado ?? true) : (resto.esSerializado ?? false),
        requierePreventivo: esEquipo ? (resto.requierePreventivo ?? true) : (resto.requierePreventivo ?? false),
        intervaloPreventivoDias: resto.intervaloPreventivoDias ?? (esEquipo ? 180 : null),
        modoTrazabilidad:
          resto.modoTrazabilidad ??
          (esEquipo && (resto.esSerializado ?? true) ? 'SERIE' : 'NINGUNA'),
        stock: 0,
        stockMinimo: resto.stockMinimo,
        stockMaximo: resto.stockMaximo ?? null,
        puntoPedido: resto.puntoPedido ?? null,
        precioUnit: resto.precioUnit ?? null,
        moneda: resto.moneda ?? 'ARS',
        categoria: resto.categoria ?? null,
        alicuotaIvaId: resto.alicuotaIvaId ?? null,
      },
    })

    if (kitItems?.length) {
      await sincronizarKitInventario(item.id, kitItems)
    }

    if (stockInicial > 0) {
      const modo =
        resto.modoTrazabilidad ??
        (esEquipo && (resto.esSerializado ?? true) ? 'SERIE' : 'NINGUNA')
      if (trazabilidadActiva(modo)) {
        throw new ApiError(
          400,
          'Con trazabilidad por unidad activa, el stock inicial debe cargarse agregando unidades (no stock global). Creá el producto con stock 0 y registrá cada unidad en la pestaña Unidades.',
        )
      }
      await registrarMovimientoStock({
        inventarioId: item.id,
        tipo: 'ENTRADA',
        cantidad: stockInicial,
        motivo: 'Stock inicial — alta manual',
        referencia: `manual:${item.id}`,
        usuarioId: actor.id,
      })
    }

    const actualizado = await prisma.inventario.findUnique({
      where: { id: item.id },
      include: {
        alicuotaIva: { select: { id: true, porcentaje: true, nombre: true } },
        kitComoEquipo: { orderBy: { orden: 'asc' }, include: { hijo: { select: { id: true, nombre: true, sku: true } } } },
      },
    })

    return NextResponse.json(plain(actualizado), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
