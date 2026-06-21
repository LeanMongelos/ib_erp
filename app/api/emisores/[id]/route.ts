import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { emisorUpdateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { plain } from '@/lib/serialize'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('emisores.update')
    const { id } = await params
    const body = await req.json()
    const data = emisorUpdateSchema.parse(body)

    const emisor = await prisma.$transaction(async (tx) => {
      if (data.predeterminado) {
        await tx.emisor.updateMany({ data: { predeterminado: false } })
      }
      return tx.emisor.update({
        where: { id },
        data: { ...data, ...(data.email !== undefined && { email: data.email || null }) },
      })
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'emisor.update',
      entidad: 'Emisor',
      entidadId: id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(emisor))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('emisores.delete')
    const { id } = await params
    // Baja lógica para no perder el histórico fiscal asociado
    await prisma.emisor.update({ where: { id }, data: { activo: false } })
    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'emisor.delete',
      entidad: 'Emisor',
      entidadId: id,
      ip: getIp(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
