import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { embudoNegocioPatchSchema } from '@/lib/validation'
import { diffEdicionNegocio, registrarEventoEmbudo } from '@/lib/crm/embudo-historial'
import { vincularPresupuestoNegocioEmbudo } from '@/lib/crm/vincular-presupuesto-embudo'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('crm.reply')
    const { id } = await params
    const body = embudoNegocioPatchSchema.parse(await req.json())

    const exists = await prisma.negocioEmbudo.findUnique({ where: { id } })
    if (!exists) throw new ApiError(404, 'Negocio no encontrado')
    if (!exists.activo) throw new ApiError(400, 'No se puede editar un negocio eliminado')

    if (body.presupuestoId) {
      await vincularPresupuestoNegocioEmbudo(id, body.presupuestoId, user.id)
      const { presupuestoId: _p, ...rest } = body
      if (Object.keys(rest).length === 0) {
        const negocio = await prisma.negocioEmbudo.findUnique({ where: { id } })
        return NextResponse.json(plain(negocio))
      }
    }

    const updateData = {
      ...body,
      proximaAccionFecha: body.proximaAccionFecha === undefined
        ? undefined
        : body.proximaAccionFecha
          ? new Date(body.proximaAccionFecha)
          : null,
    }
    delete (updateData as { presupuestoId?: string }).presupuestoId

    const cambios = diffEdicionNegocio(
      exists as unknown as Record<string, unknown>,
      updateData as Record<string, unknown>,
    )

    const negocio = await prisma.negocioEmbudo.update({
      where: { id },
      data: updateData,
    })

    if (Object.keys(cambios).length > 0) {
      await registrarEventoEmbudo({
        negocioId: id,
        tipo: 'EDICION',
        etapaDesde: exists.etapa,
        datos: { cambios },
        usuarioId: user.id,
      })
    }

    return NextResponse.json(plain(negocio))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('crm.reply')
    const { id } = await params

    const exists = await prisma.negocioEmbudo.findUnique({ where: { id } })
    if (!exists) throw new ApiError(404, 'Negocio no encontrado')
    if (!exists.activo) throw new ApiError(400, 'El negocio ya fue eliminado')

    await prisma.$transaction([
      prisma.negocioEmbudo.update({
        where: { id },
        data: { activo: false },
      }),
      prisma.historialEmbudo.create({
        data: {
          negocioId: id,
          tipo: 'ELIMINACION',
          etapaDesde: exists.etapa,
          datos: { numero: exists.numero, nombre: exists.nombre },
          usuarioId: user.id,
        },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
