import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, ApiError } from '@/lib/api-auth'
import { verifyN8nApiKey } from '@/lib/crm/n8n'
import { plain } from '@/lib/serialize'
import { leadN8nCreateSchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyN8nApiKey(req.headers.get('authorization')))) {
      throw new ApiError(401, 'API key inválida')
    }

    const data = leadN8nCreateSchema.parse(await req.json())

    const cliente = await prisma.cliente.create({
      data: {
        nombre: data.nombre,
        tipo: 'OTRO',
        email: data.email || undefined,
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
