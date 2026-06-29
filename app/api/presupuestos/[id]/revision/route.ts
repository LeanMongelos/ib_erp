import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { presupuestoRevisionSchema } from '@/lib/validation'
import { crearRevisionPresupuesto } from '@/lib/presupuestos/revision'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('presupuestos.create')
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const data = presupuestoRevisionSchema.parse(body)

    const revision = await crearRevisionPresupuesto({
      origenId: id,
      clienteId: data.clienteId,
      usuarioId: actor.id,
      motivo: data.motivo,
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: data.clienteId ? 'presupuesto.copiar' : 'presupuesto.revision',
      entidad: 'Presupuesto',
      entidadId: revision.id,
      despues: { origenId: id, version: revision.version, clienteId: revision.clienteId },
      ip: getIp(req),
    })

    return NextResponse.json(plain(revision), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
