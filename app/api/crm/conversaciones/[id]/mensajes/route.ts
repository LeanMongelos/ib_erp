import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { crmMensajeContenidoSchema } from '@/lib/validation'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('crm.reply')
    const { id } = await params
    const { contenido, adjuntoUrl } = crmMensajeContenidoSchema.parse(await req.json())

    const conv = await prisma.conversacionCRM.findUnique({
      where: { id },
      include: { canal: true },
    })
    if (!conv) throw new ApiError(404, 'Conversación no encontrada')

    const texto = contenido?.trim() ?? ''
    const preview = adjuntoUrl
      ? (texto || '[Adjunto]')
      : texto

    const mensaje = await prisma.$transaction(async (tx) => {
      const m = await tx.mensajeCRM.create({
        data: {
          conversacionId: id,
          direccion: 'SALIENTE',
          contenido: texto || '[Adjunto]',
          adjuntoUrl: adjuntoUrl ?? null,
          tipo: adjuntoUrl ? 'ADJUNTO' : 'TEXTO',
          usuarioId: actor.id,
        },
        include: { usuario: { select: { nombre: true } } },
      })
      await tx.conversacionCRM.update({
        where: { id },
        data: {
          preview: preview.slice(0, 120),
          ultimoMensajeEn: new Date(),
        },
      })
      return m
    })

    let envio: { ok: boolean; error?: string; pendienteEnvio?: boolean } | null = null
    if (conv.canal.estado === 'CONECTADO' && conv.canal.activo) {
      const { despacharMensajeSaliente } = await import('@/lib/crm/dispatch')
      envio = await despacharMensajeSaliente(mensaje.id)
    }

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'mensaje.enviar',
      entidad: 'MensajeCRM',
      entidadId: mensaje.id,
      ip: getIp(req),
    })

    const pendienteEnvio =
      conv.canal.estado !== 'CONECTADO' || !conv.canal.activo || envio?.ok === false

    return NextResponse.json(
      plain({ ...mensaje, pendienteEnvio, envioError: envio?.ok === false ? envio.error : undefined }),
      { status: 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
