import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { handleApiError, ApiError } from '@/lib/api-auth'
import { verifyN8nApiKey } from '@/lib/crm/n8n'
import { plain } from '@/lib/serialize'

const schema = z.object({
  conversacionId: z.string().min(1),
  etiquetas: z.array(z.string().trim().min(1)).min(1),
  modo: z.enum(['agregar', 'reemplazar']).default('agregar'),
})

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyN8nApiKey(req.headers.get('authorization')))) {
      throw new ApiError(401, 'API key inválida')
    }

    const { conversacionId, etiquetas, modo } = schema.parse(await req.json())

    const conv = await prisma.conversacionCRM.findUnique({ where: { id: conversacionId } })
    if (!conv) throw new ApiError(404, 'Conversación no encontrada')

    const nuevas =
      modo === 'reemplazar'
        ? etiquetas
        : Array.from(new Set([...conv.etiquetas, ...etiquetas]))

    const actualizada = await prisma.conversacionCRM.update({
      where: { id: conversacionId },
      data: { etiquetas: nuevas },
    })

    return NextResponse.json(plain(actualizada))
  } catch (error) {
    return handleApiError(error)
  }
}
