import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

/** Catálogos para autocompletar formularios del embudo CRM */
export async function GET() {
  try {
    await requirePermission('crm.read')
    const [clientes, usuarios] = await Promise.all([
      prisma.cliente.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, ciudad: true },
        orderBy: { nombre: 'asc' },
        take: 80,
      }),
      prisma.usuario.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, email: true },
        orderBy: { nombre: 'asc' },
      }),
    ])
    return NextResponse.json(plain({ clientes, usuarios }))
  } catch (error) {
    return handleApiError(error)
  }
}
