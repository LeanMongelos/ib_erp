import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

const patchSchema = z.object({
  nombre: z.string().min(1).optional(),
  cliente: z.string().min(1).optional(),
  productoServicio: z.string().optional(),
  monto: z.number().optional(),
  vendedor: z.string().optional(),
  urgencia: z.enum(['NORMAL', 'URGENTE']).optional(),
  notas: z.string().optional(),
  proximaAccionFecha: z.string().optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('crm.reply')
    const { id } = await params
    const body = patchSchema.parse(await req.json())

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
