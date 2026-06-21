/**
 * lib/storage.ts
 * Abstracción de almacenamiento de archivos (fotos de producto, PDFs,
 * certificados AFIP cifrados).
 *
 * - En desarrollo usa el disco local (`STORAGE_DIR`, por defecto `./storage`).
 * - En producción (VPS) se apunta a MinIO/S3 vía variables de entorno; el
 *   `S3StorageProvider` se implementará al construir las subidas (Fase 3/4),
 *   manteniendo esta misma interfaz para no tocar el resto del código.
 *
 * Server-only.
 */

import { promises as fs } from 'fs'
import path from 'path'

export interface StorageProvider {
  /** Guarda un objeto y devuelve su clave. */
  put(key: string, data: Buffer | Uint8Array | string, contentType?: string): Promise<{ key: string }>
  /** Lee un objeto. */
  get(key: string): Promise<Buffer>
  /** Elimina un objeto (no falla si no existe). */
  delete(key: string): Promise<void>
  /** ¿Existe el objeto? */
  exists(key: string): Promise<boolean>
}

export interface StorageConfig {
  driver: 'local' | 's3'
  localDir: string
  s3?: {
    endpoint?: string
    region?: string
    bucket?: string
    accessKeyId?: string
    secretAccessKey?: string
    forcePathStyle: boolean
  }
}

export function getStorageConfig(): StorageConfig {
  const driver = (process.env.STORAGE_DRIVER as 'local' | 's3') || 'local'
  return {
    driver,
    localDir: process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'),
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false', // MinIO requiere path-style
    },
  }
}

/** Evita rutas con `..` o absolutas que escapen del directorio de storage. */
function claveSegura(key: string): string {
  const limpia = key.replace(/\\/g, '/').replace(/^\/+/, '')
  if (limpia.split('/').some((p) => p === '..')) {
    throw new Error(`Clave de storage inválida: ${key}`)
  }
  return limpia
}

class LocalStorageProvider implements StorageProvider {
  constructor(private baseDir: string) {}

  private full(key: string): string {
    return path.join(this.baseDir, claveSegura(key))
  }

  async put(key: string, data: Buffer | Uint8Array | string): Promise<{ key: string }> {
    const dest = this.full(key)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, data)
    return { key: claveSegura(key) }
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key))
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true })
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.full(key))
      return true
    } catch {
      return false
    }
  }
}

let _storage: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (_storage) return _storage
  const cfg = getStorageConfig()
  if (cfg.driver === 's3') {
    // La implementación S3/MinIO (con @aws-sdk/client-s3) se agrega al construir
    // las subidas de archivos (Fase 3/4). Mantiene esta misma interfaz.
    throw new Error(
      'STORAGE_DRIVER=s3 todavía no está implementado. Usá STORAGE_DRIVER=local en desarrollo.',
    )
  }
  _storage = new LocalStorageProvider(cfg.localDir)
  return _storage
}
