import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getStorage } from '@/lib/storage'

const CONTENT_TYPE: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    await requirePermission('config.manage_billing_templates')
    const { path: segments } = await params
    const key = segments.join('/')

    if (!key.startsWith('plantillas/') || key.includes('..')) {
      throw new ApiError(403, 'Ruta de imagen no permitida')
    }

    const storage = getStorage()
    if (!(await storage.exists(key))) throw new ApiError(404, 'Imagen no encontrada')

    const buf = await storage.get(key)
    const ext = path.extname(key).toLowerCase()
    const contentType = CONTENT_TYPE[ext] ?? 'application/octet-stream'

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
