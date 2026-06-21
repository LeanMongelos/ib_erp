import type { TipoCanalIntegracion } from '@prisma/client'

export type WhatsAppConfig = {
  phoneNumberId?: string
  businessAccountId?: string
  accessToken?: string
  verifyToken?: string
  appSecret?: string
}

export type MetaPageConfig = {
  pageId?: string
  pageAccessToken?: string
  instagramAccountId?: string
  verifyToken?: string
  appSecret?: string
}

export type EmailImapConfig = {
  imapHost?: string
  imapPort?: number | string
  imapUser?: string
  imapPassword?: string
  smtpHost?: string
  smtpPort?: number | string
  smtpUser?: string
  smtpPassword?: string
  fromName?: string
  fromEmail?: string
  lastImapUid?: number
}

export type N8nConfig = {
  webhookUrlN8n?: string
  apiKey?: string
  baseUrl?: string
}

export function parseCanalConfig<T extends Record<string, unknown>>(config: unknown): T {
  if (!config || typeof config !== 'object') return {} as T
  return config as T
}

export function getVerifyToken(tipo: TipoCanalIntegracion, config: unknown): string | undefined {
  const c = parseCanalConfig<WhatsAppConfig & MetaPageConfig>(config)
  return c.verifyToken
}
