import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermissionAny, handleApiError, ApiError } from '@/lib/api-auth'
import { rolePermisosUpdateSchema } from '@/lib/validation'
import { WILDCARD } from '@/lib/rbac'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ clave: string }> }) {
  try {
    await requirePermissionAny('config.read', 'usuarios.read')
    const { clave } = await params
    const rol = await prisma.rolRBAC.findUnique({
      where: { clave },
      select: {
        id: true,
        clave: true,
        nombre: true,
        sistema: true,
        permisos: { select: { permiso: { select: { clave: true, modulo: true, descripcion: true } } } },
        _count: { select: { usuarios: true } },
      },
    })
    if (!rol) return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })
    return NextResponse.json({
      ...rol,
      permisos: rol.permisos.map((p) => p.permiso),
      usuariosCount: rol._count.usuarios,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ clave: string }> }) {
  try {
    const actor = await requireAuth()
    if (!actor.permissions.includes(WILDCARD)) {
      throw new ApiError(403, 'Solo el administrador del sistema puede editar permisos de roles')
    }

    const { clave } = await params
    if (clave === 'SUPERADMIN') {
      throw new ApiError(400, 'Los permisos de SUPERADMIN no se pueden modificar')
    }

    const body = await req.json()
    const { permisos } = rolePermisosUpdateSchema.parse(body)

    const rol = await prisma.rolRBAC.findUnique({
      where: { clave },
      include: { permisos: { include: { permiso: true } } },
    })
    if (!rol) return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })

    const permisosDb = await prisma.permiso.findMany({ where: { clave: { in: permisos } } })
    if (permisosDb.length !== permisos.length) {
      return NextResponse.json({ error: 'Uno o más permisos no existen' }, { status: 400 })
    }

    const antes = rol.permisos.map((p) => p.permiso.clave)

    await prisma.$transaction([
      prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } }),
      prisma.rolPermiso.createMany({
        data: permisosDb.map((p) => ({ rolId: rol.id, permisoId: p.id })),
      }),
    ])

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'rol.update_permisos',
      entidad: 'RolRBAC',
      entidadId: rol.id,
      antes: { clave, permisos: antes },
      despues: { clave, permisos },
      ip: getIp(req),
    })

    return NextResponse.json({ clave, permisos })
  } catch (error) {
    return handleApiError(error)
  }
}
