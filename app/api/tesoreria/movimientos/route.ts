import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { movimientoTesoreriaCreateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { crearMovimientoManual } from '@/lib/tesoreria/movimientos'

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('tesoreria.manage')
    const data = movimientoTesoreriaCreateSchema.parse(await req.json())

    const movimiento = await crearMovimientoManual({
      cuentaTesoreriaId: data.cuentaTesoreriaId,
      fecha: data.fecha,
      tipo: data.tipo,
      monto: data.monto,
      descripcion: data.descripcion,
      referencia: data.referencia,
      usuarioId: actor.id,
    })

    return NextResponse.json(plain(movimiento), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
