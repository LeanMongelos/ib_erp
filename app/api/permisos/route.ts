import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'

export async function GET() {
  try {
    await requirePermission('usuarios.read')
    const permisos = await prisma.permiso.findMany({
      orderBy: [{ modulo: 'asc' }, { clave: 'asc' }],
      select: { clave: true, modulo: true, descripcion: true },
    })
    return NextResponse.json(permisos)
  } catch (error) {
    return handleApiError(error)
  }
}
