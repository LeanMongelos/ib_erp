import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { decryptCanalConfig } from '@/lib/integraciones/canal-config'
import { getVerifyToken } from '@/lib/crm/config'
import type { TipoCanalIntegracion } from '@prisma/client'

export async function resolveVerifyToken(tipos: TipoCanalIntegracion[]): Promise<string | null> {
  for (const tipo of tipos) {
    const canal = await prisma.canalIntegracion.findUnique({ where: { tipo } })
    const token = canal ? getVerifyToken(tipo, decryptCanalConfig(canal.config)) : undefined
    if (token) return token
  }
  return process.env.META_VERIFY_TOKEN ?? null
}

export function verifyMetaChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  expectedToken: string | null,
): string | null {
  if (mode === 'subscribe' && token && expectedToken && token === expectedToken && challenge) {
    return challenge
  }
  return null
}

export function verifyMetaSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string | undefined,
): boolean {
  if (!appSecret) return false
  if (!signature?.startsWith('sha256=')) return false
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const received = signature.slice(7)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  } catch {
    return false
  }
}
