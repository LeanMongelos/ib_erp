import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getStorage } from '@/lib/storage'
import { getIp, registrarAuditoria } from '@/lib/audit'
import {
  INVENTARIO_BROCHURE_MAX_BYTES,
  INVENTARIO_BROCHURE_MIME,
  inventarioBrochureKey,
  inventarioBrochureMediaUrl,
  storageKeyFromInventarioBrochureUrl,
} from '@/lib/inventario/brochure-storage'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('inventario.update')
    const { id } = await params

    const item = await prisma.inventario.findUnique({ where: { id } })
    if (!item || !item.activo) throw new ApiError(404, 'Producto no encontrado')

    const form = await req.formData()
    const archivo = form.get('archivo')
    if (!archivo || !(archivo instanceof File)) {
      throw new ApiError(400, 'Debés seleccionar un archivo PDF')
    }
    if (archivo.type !== INVENTARIO_BROCHURE_MIME) {
      throw new ApiError(400, 'Formato no permitido. El brochure debe ser un PDF.')
    }
    if (archivo.size > INVENTARIO_BROCHURE_MAX_BYTES) {
      throw new ApiError(400, 'El PDF supera el límite permitido (20 MB)')
    }

    const key = inventarioBrochureKey(id)
    const storage = getStorage()
    const buf = Buffer.from(await archivo.arrayBuffer())
    await storage.put(key, buf, INVENTARIO_BROCHURE_MIME)

    const brochureUrl = inventarioBrochureMediaUrl(key)
    await prisma.inventario.update({
      where: { id },
      data: { brochureUrl },
    })

    const oldKey = storageKeyFromInventarioBrochureUrl(item.brochureUrl)
    if (oldKey && oldKey !== key) {
      await storage.delete(oldKey).catch(() => {})
    }

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'inventario.brochure_upload',
      entidad: 'Inventario',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json({ brochureUrl, storageKey: key })
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

    const oldKey = storageKeyFromInventarioBrochureUrl(item.brochureUrl)
    if (oldKey) {
      await getStorage().delete(oldKey).catch(() => {})
    }

    await prisma.inventario.update({
      where: { id },
      data: { brochureUrl: null },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'inventario.brochure_delete',
      entidad: 'Inventario',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
