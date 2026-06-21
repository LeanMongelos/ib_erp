import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

const alicuotaCreateSchema = z.object({
  codigo: z.string().trim().min(2).max(20).regex(/^[A-Z0-9_]+$/i, 'Solo letras, números y guión bajo'),
  nombre: z.string().trim().min(2).max(80),
  porcentaje: z.number().min(0).max(100),
  esPredeterminada: z.boolean().optional(),
})

const alicuotaUpdateSchema = z.object({
  nombre: z.string().trim().min(2).max(80).optional(),
  porcentaje: z.number().min(0).max(100).optional(),
  activo: z.boolean().optional(),
  esPredeterminada: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export async function GET() {
  try {
    await requireAuth()
    const alicuotas = await prisma.alicuotaIva.findMany({
      where: { activo: true },
      orderBy: { porcentaje: 'asc' },
    })
    return NextResponse.json(plain(alicuotas))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('config.update')
    const data = alicuotaCreateSchema.parse(await req.json())

    const existe = await prisma.alicuotaIva.findUnique({ where: { codigo: data.codigo.toUpperCase() } })
    if (existe) throw new ApiError(400, 'Ya existe una alícuota con ese código')

    if (data.esPredeterminada) {
      await prisma.alicuotaIva.updateMany({ data: { esPredeterminada: false } })
    }

    const alicuota = await prisma.alicuotaIva.create({
      data: {
        codigo: data.codigo.toUpperCase(),
        nombre: data.nombre,
        porcentaje: data.porcentaje,
        esPredeterminada: data.esPredeterminada ?? false,
      },
    })

    return NextResponse.json(plain(alicuota), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requirePermission('config.update')
    const body = await req.json()
    const { id, ...rest } = body as { id?: string }
    if (!id) throw new ApiError(400, 'Falta id')
    const data = alicuotaUpdateSchema.parse(rest)

    if (data.esPredeterminada) {
      await prisma.alicuotaIva.updateMany({ data: { esPredeterminada: false } })
    }

    const alicuota = await prisma.alicuotaIva.update({ where: { id }, data })
    return NextResponse.json(plain(alicuota))
  } catch (error) {
    return handleApiError(error)
  }
}
