import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { embudoSeguimientoPatchSchema } from '@/lib/validation'
import { mapEventoEmbudoDTO } from '@/lib/crm/embudo-historial'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('SUPERADMIN')
    const { id } = await params
    const body = embudoSeguimientoPatchSchema.parse(await req.json())

    const exists = await prisma.historialEmbudo.findUnique({ where: { id } })
    if (!exists) throw new ApiError(404, 'Registro de seguimiento no encontrado')

    const data: Prisma.HistorialEmbudoUpdateInput = {}
    if (body.notas !== undefined) data.notas = body.notas
    if (body.datos !== undefined) data.datos = body.datos as Prisma.InputJsonValue

    const updated = await prisma.historialEmbudo.update({
      where: { id },
      data,
      include: {
        usuario: { select: { id: true, nombre: true } },
        negocio: {
          select: {
            id: true,
            numero: true,
            nombre: true,
            cliente: true,
            vendedor: true,
            etapa: true,
            activo: true,
          },
        },
      },
    })

    return NextResponse.json(plain(mapEventoEmbudoDTO(updated)))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('SUPERADMIN')
    const { id } = await params

    const exists = await prisma.historialEmbudo.findUnique({ where: { id } })
    if (!exists) throw new ApiError(404, 'Registro de seguimiento no encontrado')

    await prisma.historialEmbudo.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
