import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { registrarEntradaHistoria } from '@/lib/equipos/historia-clinica'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'

const patchSchema = z.object({
  descripcion: z.string().min(1).optional(),
  venceEn: z.coerce.date().optional().nullable(),
  instaladoEn: z.coerce.date().optional().nullable(),
  alertaDiasAntes: z.coerce.number().int().optional(),
  activo: z.boolean().optional(),
  notas: z.string().optional().nullable(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) {
  try {
    const actor = await requirePermission('servicio.update')
    const { id: equipoId, cid } = await params
    const data = patchSchema.parse(await req.json())

    const prev = await prisma.equipoComponente.findFirst({ where: { id: cid, equipoId } })
    if (!prev) return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 })

    const componente = await prisma.equipoComponente.update({
      where: { id: cid },
      data,
    })

    if (data.venceEn !== undefined) {
      await registrarEntradaHistoria(equipoId, {
        tipo: 'COMPONENTE',
        titulo: `Actualización: ${componente.descripcion}`,
        contenido: data.venceEn
          ? `Nuevo vencimiento: ${new Date(data.venceEn).toLocaleDateString('es-AR')}`
          : 'Vencimiento removido',
        referenciaId: cid,
        usuarioId: actor.id,
      })
    }

    return NextResponse.json(plain(componente))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) {
  try {
    await requirePermission('servicio.update')
    const { id: equipoId, cid } = await params

    await prisma.equipoComponente.updateMany({
      where: { id: cid, equipoId },
      data: { activo: false },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
