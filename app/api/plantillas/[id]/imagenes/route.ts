import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getStorage } from '@/lib/storage'

const MAX_BYTES = 2 * 1024 * 1024
const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('config.manage_billing_templates')
    const { id } = await params

    const plantilla = await prisma.plantillaImpresion.findUnique({ where: { id } })
    if (!plantilla) throw new ApiError(404, 'Plantilla no encontrada')

    const form = await req.formData()
    const archivo = form.get('archivo')
    if (!archivo || !(archivo instanceof File)) {
      throw new ApiError(400, 'Debés enviar un archivo de imagen')
    }

    if (!MIME_EXT[archivo.type]) {
      throw new ApiError(400, 'Formato no permitido. Usá PNG, JPG, WEBP o GIF.')
    }
    if (archivo.size > MAX_BYTES) {
      throw new ApiError(400, 'La imagen no puede superar 2 MB')
    }

    const ext = MIME_EXT[archivo.type]
    const key = `plantillas/${id}/${randomUUID()}.${ext}`
    const storage = getStorage()
    const buf = Buffer.from(await archivo.arrayBuffer())
    await storage.put(key, buf, archivo.type)

    const content = `storage:${key}`
    const url = `/api/plantillas/media/${key.split('/').map(encodeURIComponent).join('/')}`

    return NextResponse.json({ content, url, storageKey: key })
  } catch (error) {
    return handleApiError(error)
  }
}
