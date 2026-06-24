import { NextRequest, NextResponse } from 'next/server'
import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { emisorUpdateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { registrarError } from '@/lib/error-log'
import { plain } from '@/lib/serialize'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('emisores.update')
    const { id } = await params
    const body = await req.json()
    const data = emisorUpdateSchema.parse(body)

    const anterior = await prisma.emisor.findUnique({
      where: { id },
      select: { ambiente: true, razonSocial: true },
    })
    if (!anterior) {
      return NextResponse.json({ error: 'Emisor no encontrado' }, { status: 404 })
    }

    const emisor = await prisma.$transaction(async (tx) => {
      if (data.predeterminado) {
        await tx.emisor.updateMany({ data: { predeterminado: false } })
      }
      return tx.emisor.update({
        where: { id },
        data: { ...data, ...(data.email !== undefined && { email: data.email || null }) },
      })
    })

    const ip = getIp(req)
    const ambienteCambia =
      data.ambiente !== undefined && data.ambiente !== anterior.ambiente

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'emisor.update',
      entidad: 'Emisor',
      entidadId: id,
      despues: data,
      ip,
    })

    if (ambienteCambia) {
      await registrarAuditoria({
        usuarioId: actor.id,
        accion: 'emisor.ambiente_change',
        entidad: 'Emisor',
        entidadId: id,
        antes: { ambiente: anterior.ambiente },
        despues: { ambiente: data.ambiente },
        ip,
      })
      await registrarError({
        nivel: NivelLog.WARN,
        origen: 'api',
        mensaje: `Emisor "${anterior.razonSocial}": ambiente ${anterior.ambiente} → ${data.ambiente}`,
        usuarioId: actor.id,
        ip,
        metadata: {
          emisorId: id,
          ambienteAnterior: anterior.ambiente,
          ambienteNuevo: data.ambiente,
          accion: 'emisor.ambiente_change',
        },
      })
    }

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
