import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { equipoClienteCreateSchema } from '@/lib/validation'
import { crearEquipoCliente } from '@/lib/equipos/crear-equipo-cliente'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('clientes.update')
    const { id: clienteId } = await params
    const data = equipoClienteCreateSchema.parse(await req.json())

    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId, activo: true },
      select: { id: true },
    })
    if (!cliente) throw new ApiError(404, 'Cliente no encontrado')

    const equipo = await crearEquipoCliente(clienteId, data, {
      origen: 'EXTERNO',
      usuarioId: actor.id,
    })

    return NextResponse.json(plain(equipo), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
