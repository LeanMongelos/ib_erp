import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { registrarEntradaHistoria } from '@/lib/equipos/historia-clinica'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'

const componenteSchema = z.object({
  tipo: z.enum(['BATERIA', 'FILTRO', 'CALIBRACION', 'SENSOR', 'OTRO']).default('OTRO'),
  descripcion: z.string().min(1),
  numeroSerie: z.string().optional().nullable(),
  instaladoEn: z.coerce.date().optional().nullable(),
  venceEn: z.coerce.date().optional().nullable(),
  alertaDiasAntes: z.coerce.number().int().min(1).max(365).optional(),
  notas: z.string().optional().nullable(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('servicio.update')
    const { id: equipoId } = await params
    const data = componenteSchema.parse(await req.json())

    const componente = await prisma.equipoComponente.create({
      data: { equipoId, ...data },
    })

    await registrarEntradaHistoria(equipoId, {
      tipo: 'COMPONENTE',
      titulo: `Componente registrado: ${data.descripcion}`,
      contenido: data.venceEn ? `Vence: ${new Date(data.venceEn).toLocaleDateString('es-AR')}` : data.notas,
      referenciaId: componente.id,
      usuarioId: actor.id,
    })

    return NextResponse.json(plain(componente), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
