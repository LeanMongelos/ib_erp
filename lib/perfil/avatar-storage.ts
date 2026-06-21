/** Helpers para avatares de usuario (storage local / S3). Server-only. */

import { randomUUID } from 'crypto'

const AVATAR_PREFIX = 'avatars/'

export function avatarMediaUrl(storageKey: string): string {
  return `/api/perfil/media/${storageKey.split('/').map(encodeURIComponent).join('/')}`
}

export function storageKeyFromAvatarUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (!trimmed.startsWith('/api/perfil/media/')) return null
  const encoded = trimmed.slice('/api/perfil/media/'.length)
  try {
    const key = encoded.split('/').map(decodeURIComponent).join('/')
    if (!key.startsWith(AVATAR_PREFIX) || key.includes('..')) return null
    return key
  } catch {
    return null
  }
}

export function avatarKeyForUser(userId: string, ext: string): string {
  return `${AVATAR_PREFIX}${userId}/${randomUUID()}.${ext}`
}

export const AVATAR_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
