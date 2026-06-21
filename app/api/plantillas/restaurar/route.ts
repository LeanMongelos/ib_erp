import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { PLANTILLA_FACTURA_DEFAULT, PLANTILLA_PRESUPUESTO_DEFAULT, PLANTILLA_REMITO_DEFAULT } from '@/lib/plantillas/defaults'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

const restaurarSchema = z.object({
  tipo: z.enum(['FACTURA', 'PRESUPUESTO', 'REMITO', 'NOTA_CREDITO', 'NOTA_DEBITO']),
})

const DEFAULTS: Record<string, { nombre: string; config: object }> = {
  FACTURA: { nombre: 'Factura A/B/C — IB', config: PLANTILLA_FACTURA_DEFAULT },
  PRESUPUESTO: { nombre: 'Presupuesto — IB', config: PLANTILLA_PRESUPUESTO_DEFAULT },
  REMITO: { nombre: 'Remito — IB', config: PLANTILLA_REMITO_DEFAULT },
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('config.manage_billing_templates')
    const { tipo } = restaurarSchema.parse(await req.json())
    const def = DEFAULTS[tipo]
    if (!def) return NextResponse.json({ error: 'Tipo sin default' }, { status: 400 })

    const plantilla = await prisma.$transaction(async (tx) => {
      await tx.plantillaImpresion.updateMany({
        where: { tipo: tipo as 'FACTURA' | 'PRESUPUESTO' | 'REMITO' },
        data: { predeterminado: false },
      })
      const existente = await tx.plantillaImpresion.findFirst({
        where: { tipo: tipo as 'FACTURA' | 'PRESUPUESTO' | 'REMITO', nombre: def.nombre },
      })
      if (existente) {
        return tx.plantillaImpresion.update({
          where: { id: existente.id },
          data: { config: def.config, predeterminado: true, activo: true },
        })
      }
      return tx.plantillaImpresion.create({
        data: {
          nombre: def.nombre,
          tipo: tipo as 'FACTURA' | 'PRESUPUESTO' | 'REMITO',
          config: def.config,
          predeterminado: true,
        },
      })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'plantilla.restaurar',
      entidad: 'PlantillaImpresion',
      entidadId: plantilla.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(plantilla))
  } catch (error) {
    return handleApiError(error)
  }
}
