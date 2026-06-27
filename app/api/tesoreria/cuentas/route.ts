import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { calcularSaldo } from '@/lib/tesoreria/saldo'

export async function GET() {
  try {
    await requirePermission('tesoreria.read')
    const cuentas = await prisma.cuentaTesoreria.findMany({
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
      include: {
        planCuenta: { select: { id: true, codigo: true, nombre: true } },
      },
    })

    const conSaldo = await Promise.all(
      cuentas.map(async (c) => ({
        ...c,
        saldo: await calcularSaldo(c.id),
      })),
    )

    return NextResponse.json(plain(conSaldo))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('tesoreria.manage')
    const { cuentaTesoreriaCreateSchema } = await import('@/lib/validation')
    const data = cuentaTesoreriaCreateSchema.parse(await req.json())

    if (data.predeterminada) {
      await prisma.cuentaTesoreria.updateMany({
        where: { tipo: data.tipo, predeterminada: true },
        data: { predeterminada: false },
      })
    }

    const cuenta = await prisma.cuentaTesoreria.create({
      data: {
        nombre: data.nombre,
        tipo: data.tipo,
        banco: data.banco ?? null,
        cbu: data.cbu ?? null,
        alias: data.alias ?? null,
        moneda: data.moneda ?? 'ARS',
        planCuentaId: data.planCuentaId ?? null,
        predeterminada: data.predeterminada ?? false,
      },
      include: {
        planCuenta: { select: { id: true, codigo: true, nombre: true } },
      },
    })

    return NextResponse.json(plain({ ...cuenta, saldo: 0 }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
