import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'

const accesorioSchema = z.object({
  nombre: z.string().min(1),
  inventarioId: z.string().optional().nullable(),
  cantidad: z.coerce.number().int().min(1).default(1),
  obligatorio: z.boolean().default(true),
  notas: z.string().optional().nullable(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('servicio.update')
    const { id: equipoId } = await params
    const data = accesorioSchema.parse(await req.json())

    const accesorio = await prisma.equipoAccesorio.create({
      data: { equipoId, ...data },
      include: { inventario: { select: { nombre: true, sku: true } } },
    })

    return NextResponse.json(plain(accesorio), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
