import type { TipoCanalIntegracion } from '@prisma/client'
import { testWhatsAppConnection } from '@/lib/crm/adapters/whatsapp'
import { testMetaConnection } from '@/lib/crm/adapters/meta-messenger'
import { testEmailConnection } from '@/lib/crm/adapters/email-imap'
import { testGraphConnection } from '@/lib/crm/adapters/email-graph'

export async function probarConexionCanal(
  tipo: TipoCanalIntegracion,
  config: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  switch (tipo) {
    case 'WHATSAPP':
      return testWhatsAppConnection(config)
    case 'INSTAGRAM':
    case 'FACEBOOK':
      return testMetaConnection(config)
    case 'EMAIL_IMAP':
      return testEmailConnection(config)
    case 'EMAIL_GRAPH':
      return testGraphConnection(config)
    case 'N8N':
      if (!config.webhookUrlN8n || !config.apiKey) {
        return { ok: false, error: 'Faltan webhookUrlN8n o apiKey' }
      }
      return { ok: true }
    default:
      return { ok: false, error: 'Canal desconocido' }
  }
}
