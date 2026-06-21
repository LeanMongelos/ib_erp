import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

const updateSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  nombre: z.string().trim().min(2).optional(),
  predeterminado: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('config.manage_billing_templates')
    const { id } = await params
    const data = updateSchema.parse(await req.json())

    const actual = await prisma.plantillaImpresion.findUnique({ where: { id } })
    if (!actual) throw new ApiError(404, 'Plantilla no encontrada')

    const plantilla = await prisma.$transaction(async (tx) => {
      if (data.predeterminado) {
        await tx.plantillaImpresion.updateMany({
          where: { tipo: actual.tipo },
          data: { predeterminado: false },
        })
      }
      return tx.plantillaImpresion.update({
        where: { id },
        data: {
          ...(data.config && { config: data.config as object }),
          ...(data.nombre && { nombre: data.nombre }),
          ...(data.predeterminado !== undefined && { predeterminado: data.predeterminado }),
        },
      })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'plantilla.update',
      entidad: 'PlantillaImpresion',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(plantilla))
  } catch (error) {
    return handleApiError(error)
  }
}
