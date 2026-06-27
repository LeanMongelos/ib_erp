import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { montoConSigno } from '@/lib/tesoreria/saldo'
import { calcularSaldo } from '@/lib/tesoreria/saldo'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('tesoreria.read')
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo')?.trim()
    const conciliado = searchParams.get('conciliado')
    const fechaDesde = searchParams.get('fechaDesde')?.trim()
    const fechaHasta = searchParams.get('fechaHasta')?.trim()
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? 50)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      cuentaTesoreriaId: id,
      anuladoEn: null,
    }
    if (tipo) where.tipo = tipo
    if (conciliado === 'si') where.conciliadoEn = { not: null }
    if (conciliado === 'no') where.conciliadoEn = null
    if (fechaDesde || fechaHasta) {
      const fecha: Record<string, Date> = {}
      if (fechaDesde) {
        const d = new Date(fechaDesde)
        d.setHours(0, 0, 0, 0)
        fecha.gte = d
      }
      if (fechaHasta) {
        const d = new Date(fechaHasta)
        d.setHours(23, 59, 59, 999)
        fecha.lte = d
      }
      where.fecha = fecha
    }

    const [total, movimientos, saldoActual] = await Promise.all([
      prisma.movimientoTesoreria.count({ where }),
      prisma.movimientoTesoreria.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
        skip,
        take: limit,
        include: {
          creadoPor: { select: { id: true, nombre: true } },
          conciliadoPor: { select: { id: true, nombre: true } },
          pago: {
            select: {
              id: true,
              medio: true,
              cliente: { select: { nombre: true } },
            },
          },
          pagoProveedor: {
            select: {
              id: true,
              medio: true,
              monto: true,
              proveedor: { select: { id: true, razonSocial: true } },
            },
          },
        },
      }),
      calcularSaldo(id),
    ])

    const todosOrdenados = await prisma.movimientoTesoreria.findMany({
      where: { cuentaTesoreriaId: id, anuladoEn: null },
      orderBy: [{ fecha: 'asc' }, { creadoEn: 'asc' }],
      select: { id: true, tipo: true, monto: true },
    })

    const saldoPorId = new Map<string, number>()
    let running = 0
    for (const m of todosOrdenados) {
      running += montoConSigno(m.tipo, Number(m.monto))
      saldoPorId.set(m.id, running)
    }

    const data = movimientos.map((m) => ({
      ...m,
      saldoPosterior: saldoPorId.get(m.id) ?? null,
      montoSigned: montoConSigno(m.tipo, Number(m.monto)),
    }))

    return NextResponse.json(
      plain({
        movimientos: data,
        saldoActual,
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      }),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
