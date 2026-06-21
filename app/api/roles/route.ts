import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('usuarios.read')
    const detalle = req.nextUrl.searchParams.get('detalle') === '1'

    if (!detalle) {
      const roles = await prisma.rolRBAC.findMany({
        orderBy: { nombre: 'asc' },
        select: { id: true, clave: true, nombre: true },
      })
      return NextResponse.json(roles)
    }

    const roles = await prisma.rolRBAC.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        clave: true,
        nombre: true,
        sistema: true,
        permisos: { select: { permiso: { select: { clave: true } } } },
        _count: { select: { usuarios: true } },
      },
    })

    return NextResponse.json(
      roles.map((r) => ({
        id: r.id,
        clave: r.clave,
        nombre: r.nombre,
        sistema: r.sistema,
        permisos: r.permisos.map((p) => p.permiso.clave),
        usuariosCount: r._count.usuarios,
      })),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
