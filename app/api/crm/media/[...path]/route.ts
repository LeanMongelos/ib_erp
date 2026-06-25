import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getStorage } from '@/lib/storage'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    await requirePermission('crm.read')
    const { path } = await params
    const key = path.map(decodeURIComponent).join('/')
    if (!key.startsWith('crm/adjuntos/') || key.includes('..')) {
      throw new ApiError(400, 'Ruta inválida')
    }

    const storage = getStorage()
    if (!(await storage.exists(key))) throw new ApiError(404, 'Archivo no encontrado')

    const buf = await storage.get(key)
    const ext = key.split('.').pop()?.toLowerCase()
    const mime =
      ext === 'pdf' ? 'application/pdf'
      : ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : ext === 'gif' ? 'image/gif'
      : 'image/jpeg'

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
