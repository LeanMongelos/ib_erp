import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { fleteCreateSchema, tipoFleteEnum, estadoFleteEnum } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { crearFlete, listarFletes } from '@/lib/fletes/crud'
import { registrarAuditoria, getIp } from '@/lib/audit'
import type { EstadoFlete, TipoFlete } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('fletes.read')
    const { searchParams } = new URL(req.url)
    const tipoRaw = searchParams.get('tipo') ?? ''
    const estadoRaw = searchParams.get('estado') ?? ''
    const q = searchParams.get('q') ?? ''
    const ordenCompraId = searchParams.get('ordenCompraId')?.trim() ?? ''
    const remitoVentaId = searchParams.get('remitoVentaId')?.trim() ?? ''

    const tipo = tipoFleteEnum.safeParse(tipoRaw).success ? (tipoRaw as TipoFlete) : undefined
    const estado = estadoFleteEnum.safeParse(estadoRaw).success
      ? (estadoRaw as EstadoFlete)
      : undefined

    const fletes = await listarFletes({
      tipo,
      estado,
      q: q || undefined,
      ordenCompraId: ordenCompraId || undefined,
      remitoVentaId: remitoVentaId || undefined,
    })

    return NextResponse.json(plain(fletes))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('fletes.update')
    const data = fleteCreateSchema.parse(await req.json())
    const flete = await crearFlete(data, actor.id)

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'flete.create',
      entidad: 'SeguimientoFlete',
      entidadId: flete.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(flete), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
