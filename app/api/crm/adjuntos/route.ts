import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getStorage } from '@/lib/storage'
import { prisma } from '@/lib/prisma'
import {
  CRM_ADJUNTO_MAX_BYTES,
  CRM_ADJUNTO_MIME_EXT,
  crmAdjuntoKeyForConversacion,
  crmAdjuntoMediaUrl,
} from '@/lib/crm/adjunto-storage'

export async function POST(req: NextRequest) {
  try {
    await requirePermission('crm.reply')
    const form = await req.formData()
    const archivo = form.get('archivo')
    const conversacionId = String(form.get('conversacionId') ?? '').trim()

    if (!conversacionId) throw new ApiError(400, 'Falta conversacionId')
    if (!archivo || !(archivo instanceof File)) {
      throw new ApiError(400, 'Debés seleccionar un archivo')
    }
    if (!CRM_ADJUNTO_MIME_EXT[archivo.type]) {
      throw new ApiError(400, 'Formato no permitido. Usá JPG, PNG, WEBP, GIF o PDF.')
    }
    if (archivo.size > CRM_ADJUNTO_MAX_BYTES) {
      throw new ApiError(400, 'El archivo no puede superar 5 MB')
    }

    const conv = await prisma.conversacionCRM.findUnique({
      where: { id: conversacionId },
      select: { id: true },
    })
    if (!conv) throw new ApiError(404, 'Conversación no encontrada')

    const ext = CRM_ADJUNTO_MIME_EXT[archivo.type]
    const key = crmAdjuntoKeyForConversacion(conversacionId, ext)
    const storage = getStorage()
    const buf = Buffer.from(await archivo.arrayBuffer())
    await storage.put(key, buf, archivo.type)

    return NextResponse.json({ adjuntoUrl: crmAdjuntoMediaUrl(key), nombre: archivo.name })
  } catch (error) {
    return handleApiError(error)
  }
}
