import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { registrarEntradaHistoria } from '@/lib/equipos/historia-clinica'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'

const notaSchema = z.object({
  titulo: z.string().min(1).max(200),
  contenido: z.string().max(5000).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('servicio.update')
    const { id: equipoId } = await params
    const data = notaSchema.parse(await req.json())

    const existe = await prisma.equipo.findUnique({ where: { id: equipoId }, select: { id: true } })
    if (!existe) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

    const entrada = await registrarEntradaHistoria(equipoId, {
      tipo: 'NOTA',
      titulo: data.titulo,
      contenido: data.contenido,
      usuarioId: actor.id,
    })

    return NextResponse.json(plain(entrada), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
