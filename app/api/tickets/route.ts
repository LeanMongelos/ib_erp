import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { ticketCreateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { crearTicket, listarTickets } from '@/lib/tickets/crud'

export async function GET(req: NextRequest) {
  try {
    const actor = await requirePermission('tickets.read')
    const { searchParams } = new URL(req.url)

    const tickets = await listarTickets({
      q: searchParams.get('q'),
      estado: searchParams.get('estado'),
      tipo: searchParams.get('tipo'),
      area: searchParams.get('area'),
      asignadoId: searchParams.get('asignadoId'),
      soloMios: searchParams.get('soloMios') === '1',
      modoAdmin: searchParams.get('modoAdmin') === '1',
      usuarioId: actor.id,
      permisos: actor.permissions,
    })

    return NextResponse.json(plain(tickets))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('tickets.create')
    const body = await req.json()
    const data = ticketCreateSchema.parse(body)

    const ticket = await crearTicket(data, { solicitanteId: actor.id })
    return NextResponse.json(plain(ticket), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
