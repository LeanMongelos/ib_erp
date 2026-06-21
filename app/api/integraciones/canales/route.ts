import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { buildWebhookUrl, GUIAS_INTEGRACION } from '@/lib/integraciones/guides'
import { maskSecrets, hasOAuthRefresh } from '@/lib/integraciones/crypto'

const CANALES_DEFAULT = [
  { tipo: 'WHATSAPP' as const, nombre: 'WhatsApp Business' },
  { tipo: 'INSTAGRAM' as const, nombre: 'Instagram Direct' },
  { tipo: 'FACEBOOK' as const, nombre: 'Facebook Messenger' },
  { tipo: 'EMAIL_IMAP' as const, nombre: 'Correo IMAP/SMTP' },
  { tipo: 'EMAIL_GRAPH' as const, nombre: 'Correo Microsoft 365' },
  { tipo: 'N8N' as const, nombre: 'n8n Automatizaciones' },
]

export async function GET() {
  try {
    await requirePermission('config.manage_integrations')

    for (const c of CANALES_DEFAULT) {
      await prisma.canalIntegracion.upsert({
        where: { tipo: c.tipo },
        update: {},
        create: { tipo: c.tipo, nombre: c.nombre },
      })
    }

    const canales = await prisma.canalIntegracion.findMany({ orderBy: { nombre: 'asc' } })

    const enriched = canales.map((c) => {
      const guia = GUIAS_INTEGRACION[c.tipo]
      const webhookPath = guia?.webhookPath
      return {
        ...c,
        config: maskSecrets(c.config as Record<string, unknown>),
        oauthConectado: c.tipo === 'EMAIL_GRAPH' ? hasOAuthRefresh(c.config as Record<string, unknown>) : undefined,
        webhookUrlSugerida: webhookPath ? buildWebhookUrl(webhookPath) : null,
        totalPasos: guia?.pasos.length ?? 0,
      }
    })

    return NextResponse.json(plain(enriched))
  } catch (error) {
    return handleApiError(error)
  }
}
