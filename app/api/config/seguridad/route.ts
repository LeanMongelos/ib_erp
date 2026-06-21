import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { invalidarCachePolitica, obtenerPoliticaSeguridad } from '@/lib/config/politica-seguridad'

export async function GET() {
  try {
    await requirePermission('config.update')
    const politica = await obtenerPoliticaSeguridad()
    const [usuarios, eventosLogin] = await Promise.all([
      prisma.usuario.findMany({
        select: { id: true, nombre: true, email: true, activo: true, ultimoAcceso: true, creadoEn: true },
        orderBy: { ultimoAcceso: 'desc' },
      }),
      prisma.auditLog.findMany({
        where: { accion: { in: ['login.success', 'login.rate_limited'] } },
        orderBy: { fecha: 'desc' },
        take: 50,
      }),
    ])
    return NextResponse.json(plain({ politica, usuarios, eventosLogin }))
  } catch (error) {
    return handleApiError(error)
  }
}

const politicaSchema = z.object({
  longitudMinPassword: z.number().int().min(6).max(128).optional(),
  requiereMayuscula: z.boolean().optional(),
  requiereNumero: z.boolean().optional(),
  requiereEspecial: z.boolean().optional(),
  expiracionDias: z.number().int().min(0).nullable().optional(),
  maxIntentosLogin: z.number().int().min(1).max(20).optional(),
  bloqueoMinutos: z.number().int().min(1).max(1440).optional(),
  maxIntentosIpHora: z.number().int().min(5).max(200).optional(),
  sesionMaxDias: z.number().int().min(1).max(90).optional(),
  totpHabilitado: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission('config.update')
    const data = politicaSchema.parse(await req.json())
    const antes = await obtenerPoliticaSeguridad()
    const updated = await prisma.politicaSeguridad.update({
      where: { id: 'default' },
      data,
    })
    invalidarCachePolitica()
    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'config.seguridad.update',
      entidad: 'PoliticaSeguridad',
      entidadId: 'default',
      antes,
      despues: updated,
      ip: getIp(req),
    })
    return NextResponse.json(plain(updated))
  } catch (error) {
    return handleApiError(error)
  }
}
