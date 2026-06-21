/**
 * Cifrado AES-256-GCM para credenciales de integraciones.
 * Usa INTEGRATION_SECRET o NEXTAUTH_SECRET como clave derivada.
 */

import crypto from 'crypto'

const ENC_PREFIX = 'enc:v1:'
const MASK = '••••••••'

function deriveKey(): Buffer {
  const secret = process.env.INTEGRATION_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('INTEGRATION_SECRET o NEXTAUTH_SECRET requerido para cifrar credenciales')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptValue(plain: string): string {
  if (!plain || plain.startsWith(ENC_PREFIX)) return plain
  const key = deriveKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString('base64url')
}

export function decryptValue(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored
  const key = deriveKey()
  const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64url')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function isSecretField(key: string): boolean {
  if (/^(tenantId|clientId|mailboxEmail|phoneNumberId|pageId|imapHost|imapPort|smtpHost|smtpPort|imapUser|smtpUser|fromEmail|fromName|baseUrl|businessAccountId|instagramAccountId)$/i.test(key)) {
    return false
  }
  return /password|secret|token|apiKey|refresh/i.test(key)
}

export function encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config }
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && v && isSecretField(k)) {
      out[k] = encryptValue(v)
    }
  }
  return out
}

export function decryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config }
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && v.startsWith(ENC_PREFIX)) {
      try {
        out[k] = decryptValue(v)
      } catch {
        /* mantener cifrado si corrupto */
      }
    }
  }
  return out
}

export function maskSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = { ...config }
  for (const key of Object.keys(masked)) {
    const v = masked[key]
    if (isSecretField(key) && v) masked[key] = MASK
  }
  return masked
}

export function mergeConfigUpdate(
  storedEncrypted: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const prev = decryptConfig(storedEncrypted)
  const merged: Record<string, unknown> = { ...prev }
  for (const [k, v] of Object.entries(incoming)) {
    if (v === MASK || v === '') continue
    merged[k] = v
  }
  return encryptConfig(merged)
}

export function hasOAuthRefresh(config: Record<string, unknown>): boolean {
  const dec = decryptConfig(config)
  return Boolean(dec.refreshToken)
}
