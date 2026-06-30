import { NextResponse } from 'next/server'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { listarTickets } from '@/lib/tickets/crud'
import { alertasTicketsUsuario } from '@/lib/tickets/notificaciones-inbox'
import { tienePermiso } from '@/lib/rbac'

export async function GET() {
  try {
    const actor = await requirePermission('tickets.read')
    const alertas = await alertasTicketsUsuario(actor.id)
    const noLeidas = alertas.filter((a) => !a.leida).length

    const tickets = await listarTickets({
      usuarioId: actor.id,
      permisos: actor.permissions,
      soloMios: true,
    })

    return NextResponse.json(
      plain({
        alertas,
        noLeidas,
        tickets: tickets.slice(0, 8),
        esAdmin: tienePermiso(actor.permissions, 'tickets.read_all'),
      }),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
