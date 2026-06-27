import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { saldoInicialTesoreriaSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { cargarSaldoInicial } from '@/lib/tesoreria/saldo-inicial'
import { calcularSaldo } from '@/lib/tesoreria/saldo'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission('tesoreria.initial_balance')
    const { id } = await params
    const data = saldoInicialTesoreriaSchema.parse(await req.json())

    const cuenta = await prisma.cuentaTesoreria.findUnique({ where: { id } })
    if (!cuenta) throw new ApiError(404, 'Cuenta de tesorería no encontrada')

    const movimiento = await cargarSaldoInicial(id, data.fecha, data.monto, actor.id)
    const saldo = await calcularSaldo(id)

    return NextResponse.json(plain({ movimiento, saldo }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
