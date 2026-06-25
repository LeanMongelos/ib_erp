import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { mapEventoEmbudoDTO } from '@/lib/crm/embudo-historial'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('crm.read')
    const { id } = await params

    const negocio = await prisma.negocioEmbudo.findUnique({ where: { id } })
    if (!negocio) throw new ApiError(404, 'Negocio no encontrado')

    const historial = await prisma.historialEmbudo.findMany({
      where: { negocioId: id },
      orderBy: { creadoEn: 'desc' },
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

    const items = historial.map((h) => mapEventoEmbudoDTO(h))
    return NextResponse.json(plain(items))
  } catch (error) {
    return handleApiError(error)
  }
}
