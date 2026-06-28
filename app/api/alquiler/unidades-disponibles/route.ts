import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('alquiler.read')
    const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''

    const unidades = await prisma.inventarioUnidad.findMany({
      where: {
        estado: { in: ['EN_STOCK', 'RESERVADO'] },
        inventario: { esSerializado: true, activo: true },
        ...(q && {
          OR: [
            { numeroSerie: { contains: q, mode: 'insensitive' } },
            { inventario: { nombre: { contains: q, mode: 'insensitive' } } },
          ],
        }),
      },
      select: {
        id: true,
        numeroSerie: true,
        estado: true,
        inventario: { select: { id: true, nombre: true, marca: true, modelo: true } },
      },
      orderBy: [{ inventario: { nombre: 'asc' } }, { numeroSerie: 'asc' }],
      take: 50,
    })

    return NextResponse.json(plain(unidades))
  } catch (error) {
    return handleApiError(error)
  }
}
