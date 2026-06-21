/**
 * Resolución de rutas de imagen para PDF (@react-pdf). Solo servidor.
 */
import fs from 'fs'
import path from 'path'
import { getStorageConfig } from '@/lib/storage'

const LOGO_PUBLIC = path.join(process.cwd(), 'public', 'logo.png')

function rutaPublica(rel: string): string {
  const full = path.join(process.cwd(), 'public', rel.replace(/^\//, ''))
  return fs.existsSync(full) ? full : LOGO_PUBLIC
}

export function resolveImageSrc(binding: string | undefined, content?: string): string {
  if (content?.startsWith('storage:')) {
    const key = content.slice('storage:'.length)
    const { localDir } = getStorageConfig()
    const full = path.join(localDir, key.replace(/\\/g, '/'))
    return fs.existsSync(full) ? full : LOGO_PUBLIC
  }

  const rel = content || (binding === 'emisor.logo' || binding === 'logo' ? '/logo.png' : binding) || '/logo.png'
  if (rel.startsWith('http') || rel.startsWith('data:') || rel.startsWith('file:')) return rel
  if (rel.startsWith('/')) return rutaPublica(rel)
  if (!path.isAbsolute(rel)) return rutaPublica(rel)
  return fs.existsSync(rel) ? rel : LOGO_PUBLIC
}
