import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { seedEmbudoIfEmpty, nextNumeroNegocio } from '@/lib/crm/embudo-seed'
import { calcularStatsDb, listarNegociosEmbudo } from '@/lib/crm/embudo-service'
import { embudoNegocioCreateSchema } from '@/lib/validation'

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
    const user = await requirePermission('crm.reply')
    const body = embudoNegocioCreateSchema.parse(await req.json())
    const numero = await nextNumeroNegocio(prisma)

    const negocio = await prisma.$transaction(async (tx) => {
      const creado = await tx.negocioEmbudo.create({
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
        datos: {
          ...(body.inventarioId ? { inventarioId: body.inventarioId } : {}),
          ...(body.conversacionId ? { conversacionId: body.conversacionId } : {}),
        },
        },
      })
      await tx.historialEmbudo.create({
        data: {
          negocioId: creado.id,
          tipo: 'CREACION',
          etapaHasta: creado.etapa,
          datos: {
            numero: creado.numero,
            vendedor: creado.vendedor,
            inventarioId: body.inventarioId ?? null,
          },
          usuarioId: user.id,
        },
      })
      return creado
    })

    return NextResponse.json(plain(negocio), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
