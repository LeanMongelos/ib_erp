import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { seedModulosConfigIfEmpty } from '@/lib/config/seed-modulos-config'

export async function GET() {
  try {
    await requirePermission('config.update')
    await seedModulosConfigIfEmpty()
    const [plantillas, reglas] = await Promise.all([
      prisma.plantillaNotificacion.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.reglaNotificacion.findMany({
        include: { plantilla: { select: { id: true, nombre: true, codigo: true } } },
        orderBy: { nombre: 'asc' },
      }),
    ])
    return NextResponse.json(plain({ plantillas, reglas }))
  } catch (error) {
    return handleApiError(error)
  }
}

const bodySchema = z.object({
  tipo: z.enum(['plantilla', 'regla']),
  id: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
})

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('config.update')
    const { tipo, data } = bodySchema.parse(await req.json())

    if (tipo === 'plantilla') {
      const codigo = String(data.codigo ?? '').trim().toUpperCase()
      if (!codigo) throw new ApiError(400, 'Código requerido')
      const created = await prisma.plantillaNotificacion.create({
        data: {
          codigo,
          nombre: String(data.nombre ?? codigo),
          canal: String(data.canal ?? 'SISTEMA'),
          asunto: (data.asunto as string) || null,
          cuerpo: String(data.cuerpo ?? ''),
        },
      })
      await registrarAuditoria({ usuarioId: actor.id, accion: 'config.notificaciones.update', entidad: 'PlantillaNotificacion', entidadId: created.id, despues: created, ip: getIp(req) })
      return NextResponse.json(plain(created), { status: 201 })
    }

    const codigo = String(data.codigo ?? '').trim().toUpperCase()
    if (!codigo) throw new ApiError(400, 'Código requerido')
    const created = await prisma.reglaNotificacion.create({
      data: {
        codigo,
        nombre: String(data.nombre ?? codigo),
        evento: String(data.evento ?? ''),
        diasAnticipacion: data.diasAnticipacion != null ? Number(data.diasAnticipacion) : null,
        plantillaId: (data.plantillaId as string) || null,
      },
      include: { plantilla: { select: { id: true, nombre: true, codigo: true } } },
    })
    await registrarAuditoria({ usuarioId: actor.id, accion: 'config.notificaciones.update', entidad: 'ReglaNotificacion', entidadId: created.id, despues: created, ip: getIp(req) })
    return NextResponse.json(plain(created), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission('config.update')
    const { tipo, id, data } = bodySchema.parse(await req.json())
    if (!id) throw new ApiError(400, 'Falta id')

    if (tipo === 'plantilla') {
      const updated = await prisma.plantillaNotificacion.update({ where: { id }, data: data as object })
      await registrarAuditoria({ usuarioId: actor.id, accion: 'config.notificaciones.update', entidad: 'PlantillaNotificacion', entidadId: id, despues: updated, ip: getIp(req) })
      return NextResponse.json(plain(updated))
    }

    const updated = await prisma.reglaNotificacion.update({
      where: { id },
      data: data as object,
      include: { plantilla: { select: { id: true, nombre: true, codigo: true } } },
    })
    await registrarAuditoria({ usuarioId: actor.id, accion: 'config.notificaciones.update', entidad: 'ReglaNotificacion', entidadId: id, despues: updated, ip: getIp(req) })
    return NextResponse.json(plain(updated))
  } catch (error) {
    return handleApiError(error)
  }
}
