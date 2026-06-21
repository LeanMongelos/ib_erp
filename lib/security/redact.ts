/**
 * Redacción de campos sensibles antes de enviar datos al browser.
 * Nunca confiar en "nadie va a abrir F12" — pero si lo hacen, no deben ver secretos.
 */

import { maskSecrets } from '@/lib/integraciones/crypto'

const SENSITIVE_KEY =
  /password|secret|token|apikey|api_key|refresh|credential|certificado|claveprivada|privatekey|authorization/i

const PATH_KEY = /path$/i

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key)
}

export function redactForClient<T>(value: T): T {
  return redactDeep(value) as T
}

function redactDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(redactDeep)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'config' && v && typeof v === 'object') {
        out[k] = maskSecrets(v as Record<string, unknown>)
        continue
      }
      if (isSensitiveKey(k)) {
        if (PATH_KEY.test(k) && typeof v === 'string' && v.length > 0) {
          out[k] = '[almacenado]'
          out[`${k}Configured`] = true
          continue
        }
        if (typeof v === 'string' && v.length > 0) {
          out[k] = '••••••••'
          continue
        }
      }
      out[k] = redactDeep(v)
    }
    return out
  }
  return value
}

/** Permite exponer passwordTemporal solo en la respuesta de alta de usuario (una vez). */
export function redactForClientExcept(value: unknown, allowKeys: string[]): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return redactForClient(value)
  }
  const allowed = new Set(allowKeys)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (allowed.has(k)) {
      out[k] = v
    } else if (isSensitiveKey(k)) {
      out[k] = typeof v === 'string' && v ? '••••••••' : v
    } else if (k === 'config' && v && typeof v === 'object') {
      out[k] = maskSecrets(v as Record<string, unknown>)
    } else {
      out[k] = redactDeep(v)
    }
  }
  return out
}
