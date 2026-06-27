import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { pagoProveedorCreateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { listarPagosProveedor, registrarPagoProveedor } from '@/lib/compras/pago-proveedor'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('compras.read')
    const { searchParams } = new URL(req.url)
    const proveedorId = searchParams.get('proveedorId')?.trim() ?? ''
    const estadoRaw = searchParams.get('estado') ?? ''

    const pagos = await listarPagosProveedor({
      ...(proveedorId && { proveedorId }),
      ...(estadoRaw === 'REGISTRADO' || estadoRaw === 'ANULADO' ? { estado: estadoRaw } : {}),
    })

    return NextResponse.json(plain(pagos))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.pay')
    const data = pagoProveedorCreateSchema.parse(await req.json())

    const pago = await registrarPagoProveedor(actor.id, {
      proveedorId: data.proveedorId,
      monto: data.monto,
      moneda: data.moneda,
      fecha: data.fecha,
      medio: data.medio,
      cuentaTesoreriaId: data.cuentaTesoreriaId,
      referencia: data.referencia,
      notas: data.notas,
      facturaCompraId: data.facturaCompraId,
      imputaciones: data.imputaciones,
      cheque: data.cheque,
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: data.medio === 'CHEQUE' ? 'pago_proveedor.cheque' : 'pago_proveedor.register',
      entidad: 'PagoProveedor',
      entidadId: pago!.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(pago), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
