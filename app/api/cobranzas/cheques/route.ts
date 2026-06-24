import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('cobranzas.cheques.read')
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado') ?? 'EN_CARTERA'
    const clienteId = searchParams.get('clienteId')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 25)))

    const where = {
      ...(estado !== 'TODOS' ? { estado: estado as 'EN_CARTERA' | 'DEPOSITADO' | 'RECHAZADO' | 'ANULADO' } : {}),
      ...(clienteId ? { clienteId } : {}),
    }

    const [total, cheques] = await Promise.all([
      prisma.chequeCobranza.count({ where }),
      prisma.chequeCobranza.findMany({
        where,
        orderBy: [{ fechaVencimiento: 'asc' }, { creadoEn: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cliente: { select: { id: true, nombre: true } },
          pago: {
            include: {
              imputaciones: { include: { factura: { select: { numero: true } } } },
            },
          },
        },
      }),
    ])

    return NextResponse.json(plain({
      cheques,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    }))
  } catch (error) {
    return handleApiError(error)
  }
}
