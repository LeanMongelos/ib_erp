import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { transferenciaTesoreriaSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { crearTransferencia, listarTransferenciasRecientes } from '@/lib/tesoreria/transferencia'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function GET() {
  try {
    await requirePermission('tesoreria.read')
    const transferencias = await listarTransferenciasRecientes(25)
    return NextResponse.json(plain({ transferencias }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('tesoreria.manage')
    const data = transferenciaTesoreriaSchema.parse(await req.json())

    const result = await crearTransferencia({
      cuentaOrigenId: data.cuentaOrigenId,
      cuentaDestinoId: data.cuentaDestinoId,
      monto: data.monto,
      fecha: data.fecha,
      descripcion: data.descripcion ?? 'Transferencia entre cuentas',
      creadoPorId: actor.id,
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'tesoreria.transferencia',
      entidad: 'MovimientoTesoreria',
      entidadId: result.transferenciaId,
      ip: getIp(req),
    })

    return NextResponse.json(plain(result), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
