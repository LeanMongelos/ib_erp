import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { GUIAS_INTEGRACION, buildWebhookUrl } from '@/lib/integraciones/guides'
import { mergeConfigUpdate, maskSecrets, decryptConfig } from '@/lib/integraciones/crypto'
import type { TipoCanalIntegracion } from '@prisma/client'

const updateSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  pasoCompletado: z.number().int().min(0).optional(),
  activo: z.boolean().optional(),
  estado: z.enum(['NO_CONFIGURADO', 'PENDIENTE', 'CONECTADO', 'ERROR']).optional(),
  probarConexion: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  try {
    await requirePermission('config.manage_integrations')
    const { tipo } = await params
    const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: tipo as TipoCanalIntegracion } })
    if (!canal) throw new ApiError(404, 'Canal no encontrado')

    const guia = GUIAS_INTEGRACION[tipo]
    return NextResponse.json(plain({
      canal: { ...canal, config: maskSecrets((canal.config ?? {}) as Record<string, unknown>) },
      guia,
      webhookUrlSugerida: guia?.webhookPath ? buildWebhookUrl(guia.webhookPath) : null,
      graphRedirectUri: tipo === 'EMAIL_GRAPH'
        ? `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/integraciones/graph/callback`
        : null,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  try {
    const actor = await requirePermission('config.manage_integrations')
    const { tipo } = await params
    const data = updateSchema.parse(await req.json())

    const actual = await prisma.canalIntegracion.findUnique({ where: { tipo: tipo as TipoCanalIntegracion } })
    if (!actual) throw new ApiError(404, 'Canal no encontrado')

    const configPrev = (actual.config ?? {}) as Record<string, unknown>
    let configNuevo = configPrev
    if (data.config) {
      configNuevo = mergeConfigUpdate(configPrev, data.config as Record<string, unknown>)
    }

    const configPlano = decryptConfig(configNuevo)

    let estado = data.estado ?? actual.estado
    let errorMensaje: string | null = null

    if (data.probarConexion) {
      const requeridos = camposRequeridos(tipo)
      const faltantes = requeridos.filter((c) => !configPlano[c])
      if (faltantes.length > 0) {
        estado = 'ERROR'
        errorMensaje = `Faltan campos: ${faltantes.join(', ')}`
      } else {
        const { probarConexionCanal } = await import('@/lib/crm/test-connection')
        const prueba = await probarConexionCanal(tipo as TipoCanalIntegracion, configPlano)
        if (prueba.ok) {
          estado = 'CONECTADO'
          errorMensaje = null
        } else {
          estado = 'ERROR'
          errorMensaje = prueba.error ?? 'Conexión fallida'
        }
      }
    }

    const guia = GUIAS_INTEGRACION[tipo]
    const webhookUrl = guia?.webhookPath ? buildWebhookUrl(guia.webhookPath) : actual.webhookUrl

    const canal = await prisma.canalIntegracion.update({
      where: { tipo: tipo as TipoCanalIntegracion },
      data: {
        config: configNuevo as object,
        pasoCompletado: data.pasoCompletado ?? actual.pasoCompletado,
        activo: data.activo ?? actual.activo,
        estado,
        errorMensaje,
        webhookUrl,
        ultimoSync: data.probarConexion ? new Date() : actual.ultimoSync,
      },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'integracion.update',
      entidad: 'CanalIntegracion',
      entidadId: canal.id,
      despues: { tipo, paso: data.pasoCompletado },
      ip: getIp(req),
    })

    return NextResponse.json(plain({
      ...canal,
      config: maskSecrets((canal.config ?? {}) as Record<string, unknown>),
    }))
  } catch (error) {
    return handleApiError(error)
  }
}

function camposRequeridos(tipo: string): string[] {
  switch (tipo) {
    case 'WHATSAPP': return ['phoneNumberId', 'accessToken', 'verifyToken', 'appSecret']
    case 'INSTAGRAM':
    case 'FACEBOOK': return ['pageId', 'pageAccessToken', 'verifyToken', 'appSecret']
    case 'EMAIL_IMAP': return ['imapHost', 'imapUser', 'imapPassword', 'smtpHost', 'smtpUser']
    case 'EMAIL_GRAPH': return ['tenantId', 'clientId', 'clientSecret', 'mailboxEmail']
    case 'N8N': return ['webhookUrlN8n', 'apiKey']
    default: return []
  }
}
