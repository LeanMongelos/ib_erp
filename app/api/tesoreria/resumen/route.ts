import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { calcularSaldo } from '@/lib/tesoreria/saldo'

export async function GET() {
  try {
    await requirePermission('tesoreria.read')
    const cuentas = await prisma.cuentaTesoreria.findMany({
      where: { activa: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    })

    const resumen = await Promise.all(
      cuentas.map(async (c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        moneda: c.moneda,
        saldoInicialCargado: c.saldoInicialCargado,
        predeterminada: c.predeterminada,
        saldo: await calcularSaldo(c.id),
      })),
    )

    const total = resumen.reduce((a, c) => a + c.saldo, 0)

    return NextResponse.json(plain({ cuentas: resumen, total }))
  } catch (error) {
    return handleApiError(error)
  }
}
