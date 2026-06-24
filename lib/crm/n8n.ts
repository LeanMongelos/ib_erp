import { prisma } from '@/lib/prisma'
import { parseCanalConfig, type N8nConfig } from '@/lib/crm/config'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'

export type N8nEvento =
  | 'mensaje.nuevo'
  | 'conversacion.creada'
  | 'conversacion.actualizada'
  | 'cliente.sin_respuesta_2h'

export async function getN8nConfig(): Promise<N8nConfig | null> {
  const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'N8N' } })
  if (!canal?.activo) return null
  return decryptCanalConfig(canal.config) as N8nConfig
}

export async function verifyN8nApiKey(authHeader: string | null): Promise<boolean> {
  const config = await getN8nConfig()
  const expected = config?.apiKey ?? process.env.N8N_API_KEY
  if (!expected) return false
  return validateN8nBearerToken(authHeader, expected)
}

/** Valida Bearer token n8n (helper puro — testeable sin BD). */
export function validateN8nBearerToken(authHeader: string | null, expectedKey: string): boolean {
  if (!expectedKey) return false
  if (!authHeader?.startsWith('Bearer ')) return false
  return authHeader.slice(7) === expectedKey
}

export async function emitN8nEvento(evento: N8nEvento, payload: Record<string, unknown>) {
  const config = await getN8nConfig()
  const url = config?.webhookUrlN8n
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento, timestamp: new Date().toISOString(), ...payload }),
    })
  } catch (err) {
    console.error('[n8n] Error emitiendo evento', evento, err)
  }
}
