import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { chequeEmitidoCreateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { crearChequeEmitido } from '@/lib/compras/cheque-emitido'

const chequeInclude = {
  proveedor: { select: { id: true, razonSocial: true } },
  cuentaTesoreria: { select: { id: true, nombre: true, tipo: true } },
  pagoProveedor: { select: { id: true, monto: true, medio: true, estado: true } },
  movimientoTesoreria: { select: { id: true, tipo: true, monto: true, anuladoEn: true } },
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission('compras.read')
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')?.trim() ?? ''
    const proveedorId = searchParams.get('proveedorId')?.trim() ?? ''

    const cheques = await prisma.chequeEmitido.findMany({
      where: {
        ...(estado === 'EMITIDO' || estado === 'DEBITADO' || estado === 'ANULADO' ? { estado } : {}),
        ...(proveedorId && { proveedorId }),
      },
      orderBy: [{ estado: 'asc' }, { fechaEmision: 'desc' }],
      include: chequeInclude,
    })

    return NextResponse.json(plain(cheques))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.pay')
    const data = chequeEmitidoCreateSchema.parse(await req.json())

    const cheque = await prisma.$transaction((tx) =>
      crearChequeEmitido(
        {
          pagoProveedorId: data.pagoProveedorId,
          proveedorId: data.proveedorId,
          numero: data.numero,
          banco: data.banco,
          monto: data.monto,
          fechaEmision: data.fechaEmision,
          fechaDebito: data.fechaDebito ?? null,
          cuentaTesoreriaId: data.cuentaTesoreriaId,
        },
        tx,
      ),
    )

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'cheque_emitido.create',
      entidad: 'ChequeEmitido',
      entidadId: cheque.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(cheque), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
