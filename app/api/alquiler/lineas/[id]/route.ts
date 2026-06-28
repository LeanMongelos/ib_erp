import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { lineaAlquilerUbicacionUpdateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requirePermission('alquiler.update')
    const body = await req.json()
    const data = lineaAlquilerUbicacionUpdateSchema.parse(body)

    const linea = await prisma.lineaAlquiler.findUnique({
      where: { id: params.id },
      include: { contrato: { select: { id: true, estado: true, numero: true } } },
    })

    if (!linea) {
      return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 })
    }
    if (linea.contrato.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se puede editar ubicación en contratos en borrador' },
        { status: 400 },
      )
    }

    const updated = await prisma.lineaAlquiler.update({
      where: { id: params.id },
      data: {
        ...(data.domicilio !== undefined && { domicilio: data.domicilio }),
        ...(data.localidad !== undefined && { localidad: data.localidad }),
        ...(data.provincia !== undefined && { provincia: data.provincia }),
        lat: data.lat,
        lng: data.lng,
      },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'alquiler.linea.update_ubicacion',
      entidad: 'LineaAlquiler',
      entidadId: updated.id,
      despues: { lat: data.lat, lng: data.lng, contrato: linea.contrato.numero },
      ip: getIp(req),
    })

    return NextResponse.json(plain(updated))
  } catch (error) {
    return handleApiError(error)
  }
}
