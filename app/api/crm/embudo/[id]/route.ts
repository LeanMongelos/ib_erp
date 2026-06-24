import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { embudoNegocioPatchSchema } from '@/lib/validation'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('crm.reply')
    const { id } = await params
    const body = embudoNegocioPatchSchema.parse(await req.json())

    const exists = await prisma.negocioEmbudo.findUnique({ where: { id } })
    if (!exists) throw new ApiError(404, 'Negocio no encontrado')

    const negocio = await prisma.negocioEmbudo.update({
      where: { id },
      data: {
        ...body,
        proximaAccionFecha: body.proximaAccionFecha === undefined
          ? undefined
          : body.proximaAccionFecha
            ? new Date(body.proximaAccionFecha)
            : null,
      },
    })

    return NextResponse.json(plain(negocio))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('crm.reply')
    const { id } = await params

    const exists = await prisma.negocioEmbudo.findUnique({ where: { id } })
    if (!exists) throw new ApiError(404, 'Negocio no encontrado')

    await prisma.negocioEmbudo.update({
      where: { id },
      data: { activo: false },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
