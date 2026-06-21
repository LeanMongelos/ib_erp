import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, handleApiError, ApiError } from '@/lib/api-auth'
import { getStorage } from '@/lib/storage'
import { getIp, registrarAuditoria } from '@/lib/audit'
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_EXT,
  avatarKeyForUser,
  avatarMediaUrl,
  storageKeyFromAvatarUrl,
} from '@/lib/perfil/avatar-storage'

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth()
    const form = await req.formData()
    const archivo = form.get('archivo')

    if (!archivo || !(archivo instanceof File)) {
      throw new ApiError(400, 'Debés seleccionar una imagen')
    }
    if (!AVATAR_MIME_EXT[archivo.type]) {
      throw new ApiError(400, 'Formato no permitido. Usá JPG, PNG o WEBP.')
    }
    if (archivo.size > AVATAR_MAX_BYTES) {
      throw new ApiError(400, 'La imagen no puede superar 2 MB')
    }

    const ext = AVATAR_MIME_EXT[archivo.type]
    const key = avatarKeyForUser(actor.id, ext)
    const storage = getStorage()
    const buf = Buffer.from(await archivo.arrayBuffer())
    await storage.put(key, buf, archivo.type)

    const avatarUrl = avatarMediaUrl(key)

    const prev = await prisma.usuario.findUnique({
      where: { id: actor.id },
      select: { avatarUrl: true },
    })

    await prisma.usuario.update({
      where: { id: actor.id },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    })

    const oldKey = storageKeyFromAvatarUrl(prev?.avatarUrl)
    if (oldKey && oldKey !== key) {
      await storage.delete(oldKey).catch(() => {})
    }

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'perfil.avatar_upload',
      entidad: 'Usuario',
      entidadId: actor.id,
      ip: getIp(req),
    })

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireAuth()
    const prev = await prisma.usuario.findUnique({
      where: { id: actor.id },
      select: { avatarUrl: true },
    })

    await prisma.usuario.update({
      where: { id: actor.id },
      data: { avatarUrl: null },
    })

    const oldKey = storageKeyFromAvatarUrl(prev?.avatarUrl)
    if (oldKey) {
      await getStorage().delete(oldKey).catch(() => {})
    }

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'perfil.avatar_remove',
      entidad: 'Usuario',
      entidadId: actor.id,
      ip: getIp(req),
    })

    return NextResponse.json({ avatarUrl: null })
  } catch (error) {
    return handleApiError(error)
  }
}
