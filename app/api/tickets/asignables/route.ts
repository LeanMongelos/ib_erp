import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

/** Usuarios activos para asignación (solo quien puede asignar). */
export async function GET() {
  try {
    await requirePermission('tickets.assign')
    const usuarios = await prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, email: true },
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json(plain(usuarios))
  } catch (error) {
    return handleApiError(error)
  }
}
