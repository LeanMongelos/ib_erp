import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, handleApiError } from '@/lib/api-auth'
import { perfilUpdateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function GET() {
  try {
    const actor = await requireAuth()
    const usuario = await prisma.usuario.findUnique({
      where: { id: actor.id },
      select: {
        id: true, nombre: true, email: true, telefono: true, avatarUrl: true,
        ultimoAcceso: true,
        roles: { select: { rol: { select: { clave: true, nombre: true } } } },
      },
    })
    if (!usuario) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ...usuario, roles: usuario.roles.map((r) => r.rol) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAuth() // todo usuario puede editar su propio perfil
    const body = await req.json()
    const data = perfilUpdateSchema.parse(body)

    const usuario = await prisma.usuario.update({
      where: { id: actor.id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.telefono !== undefined && { telefono: data.telefono }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl || null }),
      },
      select: { id: true, nombre: true, email: true, telefono: true, avatarUrl: true },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'perfil.update',
      entidad: 'Usuario',
      entidadId: actor.id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(usuario)
  } catch (error) {
    return handleApiError(error)
  }
}
