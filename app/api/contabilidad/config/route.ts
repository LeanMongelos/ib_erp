import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

const configPatchSchema = z.object({
  monedaFuncional: z.string().trim().max(10).optional(),
  cotizacionUsdManual: z.number().positive().nullable().optional(),
  usaCotizacionBna: z.boolean().optional(),
  agenteRetencionGanancias: z.boolean().optional(),
  agenteRetencionIva: z.boolean().optional(),
  agentePercepcionIva: z.boolean().optional(),
  agenteRetencionIibb: z.boolean().optional(),
  agentePercepcionIibb: z.boolean().optional(),
  inscriptoIibb: z.boolean().optional(),
  numeroInscripcionIibb: z.string().trim().max(40).nullable().optional(),
  convenioMultilateralIibb: z.boolean().optional(),
  libroIvaDigital: z.boolean().optional(),
  periodicidadIva: z.enum(['MENSUAL', 'BIMESTRAL']).optional(),
  cierreIvaDia: z.number().int().min(1).max(28).optional(),
  ejercicioActivoId: z.string().min(1).nullable().optional(),
  notasContador: z.string().trim().max(4000).nullable().optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission('config.manage_accounting')
    const data = configPatchSchema.parse(await req.json())

    const config = await prisma.configuracionContable.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
      include: { ejercicioActivo: true },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'contabilidad.config.update',
      entidad: 'ConfiguracionContable',
      entidadId: 'default',
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(config))
  } catch (error) {
    return handleApiError(error)
  }
}
