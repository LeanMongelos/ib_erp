import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { tienePermiso } from '@/lib/rbac'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('crm.read')
    const { id } = await params

    const conversacion = await prisma.conversacionCRM.findUnique({
      where: { id },
      include: {
        canal: true,
        cliente: { select: { id: true, nombre: true, telefono: true, email: true, tipo: true } },
        asignado: { select: { id: true, nombre: true } },
        mensajes: {
          orderBy: { fecha: 'asc' },
          include: { usuario: { select: { nombre: true } } },
        },
      },
    })
    if (!conversacion) throw new ApiError(404, 'Conversación no encontrada')

    if (conversacion.sinLeer > 0) {
      await prisma.conversacionCRM.update({
        where: { id },
        data: { sinLeer: 0 },
      })
    }

    return NextResponse.json(plain({ ...conversacion, sinLeer: 0 }))
  } catch (error) {
    return handleApiError(error)
  }
}

const patchSchema = z.object({
  estado: z.enum(['ABIERTA', 'PENDIENTE', 'CERRADA']).optional(),
  asignadoId: z.string().nullable().optional(),
  clienteId: z.string().nullable().optional(),
  etiquetas: z.array(z.string()).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth()
    const { id } = await params
    const data = patchSchema.parse(await req.json())

    const soloCliente =
      data.clienteId !== undefined &&
      data.estado === undefined &&
      data.asignadoId === undefined &&
      data.etiquetas === undefined

    const puedeAsignar = tienePermiso(actor.permissions, 'crm.assign')
    const puedeVincularCliente =
      soloCliente &&
      (puedeAsignar || tienePermiso(actor.permissions, 'crm.reply') || tienePermiso(actor.permissions, 'clientes.create'))

    if (soloCliente && !puedeVincularCliente) {
      throw new ApiError(403, 'No tenés permisos para vincular clientes')
    }
    if (!soloCliente && !puedeAsignar) {
      throw new ApiError(403, 'No tenés permisos para editar conversaciones')
    }

    const conversacion = await prisma.conversacionCRM.update({
      where: { id },
      data,
      include: {
        canal: { select: { tipo: true, nombre: true } },
        cliente: { select: { id: true, nombre: true } },
        asignado: { select: { id: true, nombre: true } },
      },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'conversacion.update',
      entidad: 'ConversacionCRM',
      entidadId: id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(conversacion))
  } catch (error) {
    return handleApiError(error)
  }
}
