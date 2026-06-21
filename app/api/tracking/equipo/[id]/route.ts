import { NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getRecorridoEquipo } from '@/lib/tracking'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('tracking.read')
    const { id } = await params

    const equipo = await prisma.equipo.findUnique({
      where: { id },
      include: { cliente: { select: { nombre: true, ciudad: true } } },
    })
    if (!equipo) throw new ApiError(404, 'Equipo no encontrado')

    const recorrido = await getRecorridoEquipo(id)

    return NextResponse.json(plain({ equipo, recorrido }))
  } catch (error) {
    return handleApiError(error)
  }
}
