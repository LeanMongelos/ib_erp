/**
 * Convierte fotoUrl de inventario a data URI para @react-pdf (server-only).
 */
import path from 'path'
import { getStorage, getStorageConfig } from '@/lib/storage'
import { storageKeyFromInventarioFotoUrl } from '@/lib/inventario/foto-storage'

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

export async function resolveFotoUrlParaPdf(fotoUrl: string | null | undefined): Promise<string | null> {
  if (!fotoUrl?.trim()) return null

  const key = storageKeyFromInventarioFotoUrl(fotoUrl)
  if (key) {
    const storage = getStorage()
    if (!(await storage.exists(key))) return null
    const buf = await storage.get(key)
    const ext = path.extname(key).toLowerCase()
    const mime = MIME[ext] ?? 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  }

  if (fotoUrl.startsWith('http') || fotoUrl.startsWith('data:')) return fotoUrl

  if (fotoUrl.startsWith('/')) {
    const { localDir } = getStorageConfig()
    const rel = fotoUrl.replace(/^\//, '')
    const full = path.join(process.cwd(), 'public', rel)
    try {
      const fs = await import('fs/promises')
      const buf = await fs.readFile(full)
      const ext = path.extname(full).toLowerCase()
      const mime = MIME[ext] ?? 'image/png'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  }

  return null
}

export async function resolverFotosItemsPdf<T extends { fotoUrl?: string | null }>(
  items: T[],
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.fotoUrl) return item
      const resuelta = await resolveFotoUrlParaPdf(item.fotoUrl)
      return resuelta ? { ...item, fotoUrl: resuelta } : { ...item, fotoUrl: null }
    }),
  )
}
