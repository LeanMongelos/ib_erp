import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('cobranzas.read')
    const { searchParams } = new URL(req.url)
    const soloPendientes = searchParams.get('pendientes') !== 'false'
    const dias = Number(searchParams.get('dias') ?? 90)

    const hasta = new Date()
    hasta.setDate(hasta.getDate() + dias)

    const vencimientos = await prisma.vencimientoCobranza.findMany({
      where: {
        ...(soloPendientes
          ? { estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] } }
          : {}),
        fechaVencimiento: { lte: hasta },
        factura: { estado: { notIn: ['PAGADA', 'ANULADA'] } },
      },
      include: {
        factura: {
          select: {
            id: true,
            numero: true,
            total: true,
            condicionPago: true,
            estado: true,
            fechaEmision: true,
            cliente: { select: { nombre: true } },
          },
        },
      },
      orderBy: [{ fechaVencimiento: 'asc' }, { numeroCuota: 'asc' }],
      take: 100,
    })

    return NextResponse.json(plain(vencimientos))
  } catch (error) {
    return handleApiError(error)
  }
}
