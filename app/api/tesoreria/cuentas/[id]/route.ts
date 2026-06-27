import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { cuentaTesoreriaUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { calcularSaldo } from '@/lib/tesoreria/saldo'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('tesoreria.manage')
    const { id } = await params
    const data = cuentaTesoreriaUpdateSchema.parse(await req.json())

    const existente = await prisma.cuentaTesoreria.findUnique({ where: { id } })
    if (!existente) throw new ApiError(404, 'Cuenta de tesorería no encontrada')

    if (data.predeterminada) {
      await prisma.cuentaTesoreria.updateMany({
        where: { tipo: existente.tipo, predeterminada: true, id: { not: id } },
        data: { predeterminada: false },
      })
    }

    const cuenta = await prisma.cuentaTesoreria.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.banco !== undefined ? { banco: data.banco } : {}),
        ...(data.cbu !== undefined ? { cbu: data.cbu } : {}),
        ...(data.alias !== undefined ? { alias: data.alias } : {}),
        ...(data.moneda !== undefined ? { moneda: data.moneda } : {}),
        ...(data.planCuentaId !== undefined ? { planCuentaId: data.planCuentaId } : {}),
        ...(data.activa !== undefined ? { activa: data.activa } : {}),
        ...(data.predeterminada !== undefined ? { predeterminada: data.predeterminada } : {}),
      },
      include: {
        planCuenta: { select: { id: true, codigo: true, nombre: true } },
      },
    })

    const saldo = await calcularSaldo(cuenta.id)
    return NextResponse.json(plain({ ...cuenta, saldo }))
  } catch (error) {
    return handleApiError(error)
  }
}
