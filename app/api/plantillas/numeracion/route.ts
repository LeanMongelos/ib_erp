import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { listarResumenNumeracion } from '@/lib/numeracion'

const patchSchema = z.object({
  secuencias: z.array(z.object({
    clave: z.string().min(1),
    proximoNumero: z.number().int().min(1),
  })).min(1),
})

export async function GET() {
  try {
    await requirePermission('config.manage_billing_templates')
    const secuencias = await listarResumenNumeracion()
    return NextResponse.json(plain(secuencias))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission('config.manage_billing_templates')
    const { secuencias } = patchSchema.parse(await req.json())

    for (const s of secuencias) {
      await prisma.secuenciaNumeracion.update({
        where: { clave: s.clave },
        data: { proximoNumero: s.proximoNumero },
      })
    }

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'plantillas.numeracion.update',
      entidad: 'SecuenciaNumeracion',
      entidadId: secuencias.map((s) => s.clave).join(','),
      despues: secuencias,
      ip: getIp(req),
    })

    const resumen = await listarResumenNumeracion()
    return NextResponse.json(plain(resumen))
  } catch (error) {
    return handleApiError(error)
  }
}
