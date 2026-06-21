import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { seedEmbudoIfEmpty, nextNumeroNegocio } from '@/lib/crm/embudo-seed'
import { calcularStatsDb, listarNegociosEmbudo } from '@/lib/crm/embudo-service'

const createSchema = z.object({
  nombre: z.string().min(1),
  cliente: z.string().min(1),
  clienteId: z.string().min(1).optional().nullable(),
  productoServicio: z.string().min(1),
  inventarioId: z.string().min(1).optional().nullable(),
  monto: z.number().optional(),
  vendedor: z.string().min(1),
  urgencia: z.enum(['NORMAL', 'URGENTE']).optional(),
  etapa: z.enum(['ENTRADA', 'CONTACTO', 'DOCUMENTACION', 'PROPUESTA', 'SEGUIMIENTO', 'ANALISIS', 'ENTREGA', 'CIERRE']).optional(),
  notas: z.string().optional(),
})

export async function GET() {
  try {
    await requirePermission('crm.read')
    await seedEmbudoIfEmpty(prisma)
    const negocios = await listarNegociosEmbudo()
    const stats = calcularStatsDb(negocios)
    return NextResponse.json({ negocios: plain(negocios), stats: plain(stats) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('crm.reply')
    const body = createSchema.parse(await req.json())
    const numero = await nextNumeroNegocio(prisma)

    const negocio = await prisma.negocioEmbudo.create({
      data: {
        numero,
        nombre: body.nombre,
        cliente: body.cliente,
        clienteId: body.clienteId ?? null,
        productoServicio: body.productoServicio,
        monto: body.monto ?? 0,
        vendedor: body.vendedor,
        urgencia: body.urgencia ?? 'NORMAL',
        etapa: body.etapa ?? 'ENTRADA',
        notas: body.notas,
        etapaDesde: new Date(),
        datos: body.inventarioId ? { inventarioId: body.inventarioId } : {},
      },
    })

    return NextResponse.json(plain(negocio), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
