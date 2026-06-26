import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { inventarioUnidadUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { sincronizarStockDesdeUnidades, validarDepositoActivo } from '@/lib/inventario/unidades'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    await requirePermission('inventario.update')
    const { uid } = await params
    const data = inventarioUnidadUpdateSchema.parse(await req.json())

    const unidad = await prisma.$transaction(async (tx) => {
      const prev = await tx.inventarioUnidad.findUnique({
        where: { id: uid },
        include: { inventario: { select: { modoTrazabilidad: true } } },
      })
      if (!prev) throw new ApiError(404, 'Unidad no encontrada')
      if (prev.estado === 'VENDIDO') {
        throw new ApiError(400, 'No se puede editar una unidad ya vendida')
      }

      const numeroSerie = data.numeroSerie !== undefined ? (data.numeroSerie?.trim() || null) : prev.numeroSerie
      const lote = data.lote !== undefined ? (data.lote?.trim() || null) : prev.lote

      if (numeroSerie && numeroSerie !== prev.numeroSerie) {
        const dup = await tx.inventarioUnidad.findFirst({
          where: { inventarioId: prev.inventarioId, numeroSerie, id: { not: uid } },
        })
        if (dup) throw new ApiError(409, `Ya existe otra unidad con el número de serie «${numeroSerie}»`)
      }

      if (data.depositoId !== undefined) {
        await validarDepositoActivo(data.depositoId, tx)
      }

      const actualizada = await tx.inventarioUnidad.update({
        where: { id: uid },
        data: {
          numeroSerie: data.numeroSerie !== undefined ? numeroSerie : undefined,
          lote: data.lote !== undefined ? lote : undefined,
          notas: data.notas !== undefined ? (data.notas?.trim() || null) : undefined,
          fechaIngreso: data.fechaIngreso,
          estado: data.estado,
          depositoId: data.depositoId !== undefined ? (data.depositoId?.trim() || null) : undefined,
          ubicacionDetalle:
            data.ubicacionDetalle !== undefined
              ? (data.ubicacionDetalle?.trim() || null)
              : undefined,
        },
        include: { deposito: { select: { id: true, nombre: true, tipo: true } } },
      })

      if (data.estado === 'EN_STOCK' || data.estado === 'BAJA' || data.estado === 'RESERVADO') {
        await sincronizarStockDesdeUnidades(prev.inventarioId, tx)
      }

      return actualizada
    })

    return NextResponse.json(plain(unidad))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    await requirePermission('inventario.update')
    const { uid } = await params

    await prisma.$transaction(async (tx) => {
      const prev = await tx.inventarioUnidad.findUnique({ where: { id: uid } })
      if (!prev) throw new ApiError(404, 'Unidad no encontrada')
      if (prev.estado === 'VENDIDO') {
        throw new ApiError(400, 'No se puede eliminar una unidad vendida')
      }

      await tx.inventarioUnidad.delete({ where: { id: uid } })
      await sincronizarStockDesdeUnidades(prev.inventarioId, tx)
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
