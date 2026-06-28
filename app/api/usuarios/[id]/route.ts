import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { requireSecureMutation } from '@/lib/security/secure-mutation'
import { usuarioUpdateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import {
  validarConfirmacionPassword,
  validarYHashearPassword,
} from '@/lib/usuarios/asignar-password'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('usuarios.read')
    const { id } = await params
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true, nombre: true, email: true, telefono: true, activo: true,
        ultimoAcceso: true, creadoEn: true,
        roles: { select: { rol: { select: { clave: true, nombre: true } } } },
      },
    })
    if (!usuario) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ...usuario, roles: usuario.roles.map((r) => r.rol) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSecureMutation(req, 'usuarios.update')
    const { id } = await params

    const body = await req.json()
    const data = usuarioUpdateSchema.parse(body)

    validarConfirmacionPassword(data.password, data.confirmarPassword)

    // Cambiar roles requiere permiso específico
    if (data.roles) {
      await requirePermission('usuarios.assign_roles')
      const actorEsSuper = (actor.roles ?? []).includes('SUPERADMIN')
      if (data.roles.includes('SUPERADMIN') && !actorEsSuper) {
        throw new ApiError(403, 'Solo SUPERADMIN puede asignar ese rol')
      }
      if (actor.id === id && !actorEsSuper) {
        throw new ApiError(400, 'No podés modificar tus propios roles')
      }
    }

    const existente = await prisma.usuario.findUnique({
      where: { id },
      include: { roles: { include: { rol: true } } },
    })
    if (!existente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // Evitar que un usuario se quite a sí mismo o desactive su propia cuenta
    if (actor.id === id && data.activo === false) {
      throw new ApiError(400, 'No podés desactivar tu propia cuenta')
    }

    let rolesUpdate = {}
    if (data.roles) {
      const rolesDb = await prisma.rolRBAC.findMany({ where: { clave: { in: data.roles } } })
      if (rolesDb.length !== data.roles.length) {
        return NextResponse.json({ error: 'Uno o más roles no existen' }, { status: 400 })
      }
      rolesUpdate = {
        roles: {
          deleteMany: {},
          create: rolesDb.map((r) => ({ rolId: r.id })),
        },
      }
    }

    let passwordUpdate = {}
    if (data.password) {
      const passwordHash = await validarYHashearPassword(data.password)
      passwordUpdate = {
        password: passwordHash,
        exigirCambioPassword: data.exigirCambioPassword ?? false,
      }
    } else if (data.exigirCambioPassword !== undefined) {
      passwordUpdate = { exigirCambioPassword: data.exigirCambioPassword }
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.telefono !== undefined && { telefono: data.telefono }),
        ...(data.activo !== undefined && { activo: data.activo }),
        ...rolesUpdate,
        ...passwordUpdate,
      },
      select: { id: true, nombre: true, email: true, activo: true },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: data.roles ? 'usuario.roles_update' : 'usuario.update',
      entidad: 'Usuario',
      entidadId: id,
      antes: { nombre: existente.nombre, activo: existente.activo, roles: existente.roles.map((r) => r.rol.clave) },
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(usuario)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('usuarios.deactivate')
    const { id } = await params
    if (actor.id === id) throw new ApiError(400, 'No podés desactivar tu propia cuenta')

    await prisma.usuario.update({ where: { id }, data: { activo: false } })
    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'usuario.deactivate',
      entidad: 'Usuario',
      entidadId: id,
      ip: getIp(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
