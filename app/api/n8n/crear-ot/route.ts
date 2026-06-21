import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addHours } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { handleApiError, ApiError } from '@/lib/api-auth'
import { verifyN8nApiKey } from '@/lib/crm/n8n'
import { siguienteNumeroOT, crearConNumeroUnico } from '@/lib/sequences'
import { plain } from '@/lib/serialize'

const schema = z.object({
  clienteId: z.string().min(1),
  descripcion: z.string().trim().min(5),
  equipoId: z.string().optional(),
  prioridad: z.enum(['BAJA', 'NORMAL', 'ALTA', 'URGENTE']).default('NORMAL'),
  slaHoras: z.number().int().min(1).max(720).default(48),
  conversacionId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyN8nApiKey(req.headers.get('authorization')))) {
      throw new ApiError(401, 'API key inválida')
    }

    const data = schema.parse(await req.json())

    const cliente = await prisma.cliente.findUnique({ where: { id: data.clienteId } })
    if (!cliente) throw new ApiError(404, 'Cliente no encontrado')

    const slaVence = addHours(new Date(), data.slaHoras)

    const ot = await crearConNumeroUnico(
      siguienteNumeroOT,
      (numero) =>
        prisma.ordenTrabajo.create({
          data: {
            numero,
            descripcion: data.descripcion,
            clienteId: data.clienteId,
            equipoId: data.equipoId ?? null,
            prioridad: data.prioridad,
            slaHoras: data.slaHoras,
            slaVence,
            estado: 'ABIERTA',
            historial: {
              create: { estado: 'ABIERTA', nota: 'OT creada vía n8n' },
            },
          },
          include: { cliente: true },
        }),
    )

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
