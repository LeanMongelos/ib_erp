import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { handleApiError, ApiError } from '@/lib/api-auth'
import { verifyN8nApiKey } from '@/lib/crm/n8n'
import { plain } from '@/lib/serialize'

const schema = z.object({
  nombre: z.string().trim().min(2),
  email: z.string().email().optional(),
  telefono: z.string().optional(),
  notas: z.string().optional(),
  conversacionId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyN8nApiKey(req.headers.get('authorization')))) {
      throw new ApiError(401, 'API key inválida')
    }

    const data = schema.parse(await req.json())

    const cliente = await prisma.cliente.create({
      data: {
        nombre: data.nombre,
        tipo: 'OTRO',
        email: data.email,
        telefono: data.telefono,
        notas: data.notas ? `[Lead n8n] ${data.notas}` : '[Lead n8n]',
        activo: true,
      },
    })

    if (data.conversacionId) {
      await prisma.conversacionCRM.update({
        where: { id: data.conversacionId },
        data: { clienteId: cliente.id },
      }).catch(() => {})
    }

    return NextResponse.json(plain(cliente), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
