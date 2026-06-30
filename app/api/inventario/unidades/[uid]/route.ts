import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { inventarioUnidadUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import {
  sincronizarStockDesdeUnidades,
  validarDepositoActivo,
  moverUnidadEntreDepositos,
  validarNumeroSerieUnico,
} from '@/lib/inventario/unidades'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const actor = await requirePermission('inventario.update')
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

      const numeroSerie =
        data.numeroSerie !== undefined ? (data.numeroSerie?.trim() || null) : prev.numeroSerie
      const lote = data.lote !== undefined ? (data.lote?.trim() || null) : prev.lote

      if (data.numeroSerie !== undefined) {
        await validarNumeroSerieUnico(numeroSerie, prev.inventario.modoTrazabilidad, {
          inventarioId: prev.inventarioId,
          unidadIdExcluir: uid,
        }, tx)
      }

      const nuevoDepositoId =
        data.depositoId !== undefined ? (data.depositoId?.trim() || null) : prev.depositoId
      const cambiaDeposito =
        data.depositoId !== undefined && nuevoDepositoId !== prev.depositoId

      if (cambiaDeposito && prev.estado === 'EN_STOCK') {
        await moverUnidadEntreDepositos(
          {
            unidadId: uid,
            depositoDestinoId: nuevoDepositoId,
            ubicacionDetalle:
              data.ubicacionDetalle !== undefined ? data.ubicacionDetalle : prev.ubicacionDetalle,
            usuarioId: actor.id,
          },
          tx,
        )
      } else if (data.depositoId !== undefined) {
        await validarDepositoActivo(data.depositoId, tx)
      }

      const camposExtra: Record<string, unknown> = {}
      if (data.numeroSerie !== undefined) camposExtra.numeroSerie = numeroSerie
      if (data.lote !== undefined) camposExtra.lote = lote
      if (data.notas !== undefined) camposExtra.notas = data.notas?.trim() || null
      if (data.fechaIngreso !== undefined) camposExtra.fechaIngreso = data.fechaIngreso
      if (data.estado !== undefined) camposExtra.estado = data.estado
      if (!cambiaDeposito && data.depositoId !== undefined) camposExtra.depositoId = nuevoDepositoId
      if (!cambiaDeposito && data.ubicacionDetalle !== undefined) {
        camposExtra.ubicacionDetalle = data.ubicacionDetalle?.trim() || null
      }

      if (Object.keys(camposExtra).length > 0) {
        await tx.inventarioUnidad.update({ where: { id: uid }, data: camposExtra })
      }

      if (data.estado === 'EN_STOCK' || data.estado === 'BAJA' || data.estado === 'RESERVADO') {
        await sincronizarStockDesdeUnidades(prev.inventarioId, tx)
      }

      const actualizada = await tx.inventarioUnidad.findUnique({
        where: { id: uid },
        include: { deposito: { select: { id: true, nombre: true, tipo: true } } },
      })
      if (!actualizada) throw new ApiError(404, 'Unidad no encontrada')
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
