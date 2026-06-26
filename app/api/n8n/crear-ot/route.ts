import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, ApiError } from '@/lib/api-auth'
import { verifyN8nApiKey } from '@/lib/crm/n8n'
import { otN8nCreateSchema } from '@/lib/validation'
import { crearOrdenTrabajo } from '@/lib/ots/crear-ot'
import { plain } from '@/lib/serialize'

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyN8nApiKey(req.headers.get('authorization')))) {
      throw new ApiError(401, 'API key inválida')
    }

    const data = otN8nCreateSchema.parse(await req.json())

    const cliente = await prisma.cliente.findUnique({ where: { id: data.clienteId } })
    if (!cliente) throw new ApiError(404, 'Cliente no encontrado')

    const ot = await crearOrdenTrabajo(data, { notaHistorial: 'OT creada vía n8n' })

    if (data.conversacionId) {
      await prisma.conversacionCRM.update({
        where: { id: data.conversacionId },
        data: { etiquetas: { push: `OT:${ot.numero}` } },
      }).catch(() => {})
    }

    return NextResponse.json(plain(ot), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
