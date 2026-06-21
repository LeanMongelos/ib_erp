import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { handleApiError, ApiError } from '@/lib/api-auth'
import { verifyN8nApiKey } from '@/lib/crm/n8n'
import { despacharMensajeSaliente } from '@/lib/crm/dispatch'
import { plain } from '@/lib/serialize'

const schema = z.object({
  conversacionId: z.string().min(1),
  contenido: z.string().trim().min(1).max(4000),
})

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyN8nApiKey(req.headers.get('authorization')))) {
      throw new ApiError(401, 'API key inválida')
    }

    const { conversacionId, contenido } = schema.parse(await req.json())

    const conv = await prisma.conversacionCRM.findUnique({ where: { id: conversacionId } })
    if (!conv) throw new ApiError(404, 'Conversación no encontrada')

    const mensaje = await prisma.$transaction(async (tx) => {
      const m = await tx.mensajeCRM.create({
        data: {
          conversacionId,
          direccion: 'SALIENTE',
          contenido,
        },
      })
      await tx.conversacionCRM.update({
        where: { id: conversacionId },
        data: { preview: contenido.slice(0, 120), ultimoMensajeEn: new Date() },
      })
      return m
    })

    const envio = await despacharMensajeSaliente(mensaje.id)

    return NextResponse.json(plain({ mensaje, envio }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
