import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { crearOrdenTrabajo } from '@/lib/ots/crear-ot'
import { otCreateSchema } from '@/lib/validation'
import { listarOTs } from '@/lib/ots/listar-ots'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('servicio.read')

    const { searchParams } = new URL(req.url)
    const ots = await listarOTs({
      q: searchParams.get('q'),
      estado: searchParams.get('estado'),
      tecnicoId: searchParams.get('tecnicoId'),
      clienteId: searchParams.get('clienteId'),
      prioridad: searchParams.get('prioridad'),
      tipo: searchParams.get('tipo'),
      sla: searchParams.get('sla'),
    })

    return NextResponse.json(ots)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('servicio.create')
    const body = await req.json()
    const data = otCreateSchema.parse(body)

    const ot = await crearOrdenTrabajo(data, { usuarioId: actor.id })
    return NextResponse.json(ot, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
