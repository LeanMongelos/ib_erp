import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getStorage } from '@/lib/storage'
import { getIp, registrarAuditoria } from '@/lib/audit'
import {
  INVENTARIO_FOTO_MAX_BYTES,
  INVENTARIO_FOTO_MIME_EXT,
  inventarioFotoKey,
  inventarioFotoMediaUrl,
  storageKeyFromInventarioFotoUrl,
} from '@/lib/inventario/foto-storage'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('inventario.update')
    const { id } = await params

    const item = await prisma.inventario.findUnique({ where: { id } })
    if (!item || !item.activo) throw new ApiError(404, 'Producto no encontrado')

    const form = await req.formData()
    const archivo = form.get('archivo')
    if (!archivo || !(archivo instanceof File)) {
      throw new ApiError(400, 'Debés seleccionar una imagen')
    }
    if (!INVENTARIO_FOTO_MIME_EXT[archivo.type]) {
      throw new ApiError(400, 'Formato no permitido. Usá JPG, PNG o WEBP.')
    }
    if (archivo.size > INVENTARIO_FOTO_MAX_BYTES) {
      throw new ApiError(400, 'La imagen comprimida supera el límite permitido (600 KB)')
    }

    const ext = INVENTARIO_FOTO_MIME_EXT[archivo.type]
    const key = inventarioFotoKey(id, ext)
    const storage = getStorage()
    const buf = Buffer.from(await archivo.arrayBuffer())
    await storage.put(key, buf, archivo.type)

    const fotoUrl = inventarioFotoMediaUrl(key)
    await prisma.inventario.update({
      where: { id },
      data: { fotoUrl },
    })

    const oldKey = storageKeyFromInventarioFotoUrl(item.fotoUrl)
    if (oldKey && oldKey !== key) {
      await storage.delete(oldKey).catch(() => {})
    }

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'inventario.foto_upload',
      entidad: 'Inventario',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json({ fotoUrl, storageKey: key })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('inventario.update')
    const { id } = await params

    const item = await prisma.inventario.findUnique({ where: { id } })
    if (!item) throw new ApiError(404, 'Producto no encontrado')

    const oldKey = storageKeyFromInventarioFotoUrl(item.fotoUrl)
    if (oldKey) {
      await getStorage().delete(oldKey).catch(() => {})
    }

    await prisma.inventario.update({
      where: { id },
      data: { fotoUrl: null },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'inventario.foto_delete',
      entidad: 'Inventario',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
