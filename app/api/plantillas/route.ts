import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

const plantillaCreateSchema = z.object({
  nombre: z.string().trim().min(2),
  tipo: z.enum(['FACTURA', 'PRESUPUESTO', 'REMITO', 'NOTA_CREDITO', 'NOTA_DEBITO']),
  config: z.record(z.string(), z.unknown()),
  predeterminado: z.boolean().optional(),
})

export async function GET() {
  try {
    await requirePermission('config.manage_billing_templates')
    const plantillas = await prisma.plantillaImpresion.findMany({
      where: { activo: true },
      orderBy: [{ tipo: 'asc' }, { predeterminado: 'desc' }, { nombre: 'asc' }],
    })
    return NextResponse.json(plain(plantillas))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('config.manage_billing_templates')
    const data = plantillaCreateSchema.parse(await req.json())

    const plantilla = await prisma.$transaction(async (tx) => {
      if (data.predeterminado) {
        await tx.plantillaImpresion.updateMany({
          where: { tipo: data.tipo },
          data: { predeterminado: false },
        })
      }
      return tx.plantillaImpresion.create({
        data: {
          nombre: data.nombre,
          tipo: data.tipo,
          config: data.config as object,
          predeterminado: data.predeterminado ?? false,
        },
      })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'plantilla.create',
      entidad: 'PlantillaImpresion',
      entidadId: plantilla.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(plantilla), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
