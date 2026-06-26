import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { inventarioUnidadCreateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { sincronizarStockDesdeUnidades, validarDepositoActivo, validarUnidadNueva } from '@/lib/inventario/unidades'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('inventario.read')
    const { id } = await params
    const estado = new URL(req.url).searchParams.get('estado')?.trim()

    const inv = await prisma.inventario.findUnique({ where: { id }, select: { id: true } })
    if (!inv) throw new ApiError(404, 'Producto no encontrado')

    const unidades = await prisma.inventarioUnidad.findMany({
      where: {
        inventarioId: id,
        ...(estado ? { estado: estado as 'EN_STOCK' | 'RESERVADO' | 'VENDIDO' | 'BAJA' } : {}),
      },
      orderBy: [{ estado: 'asc' }, { fechaIngreso: 'desc' }],
      include: {
        deposito: { select: { id: true, nombre: true, tipo: true } },
        equipo: { select: { id: true, nombre: true, clienteId: true } },
        itemFacturaReservado: { select: { id: true, facturaId: true } },
      },
    })

    return NextResponse.json(plain(unidades))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('inventario.update')
    const { id } = await params
    const data = inventarioUnidadCreateSchema.parse(await req.json())

    const unidad = await prisma.$transaction(async (tx) => {
      await validarUnidadNueva(id, data, tx)
      const creada = await tx.inventarioUnidad.create({
        data: {
          inventarioId: id,
          numeroSerie: data.numeroSerie?.trim() || null,
          lote: data.lote?.trim() || null,
          notas: data.notas?.trim() || null,
          fechaIngreso: data.fechaIngreso ?? new Date(),
          depositoId: data.depositoId?.trim() || null,
          ubicacionDetalle: data.ubicacionDetalle?.trim() || null,
          estado: 'EN_STOCK',
        },
        include: { deposito: { select: { id: true, nombre: true, tipo: true } } },
      })
      await sincronizarStockDesdeUnidades(id, tx)
      return creada
    })

    return NextResponse.json(plain(unidad), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
