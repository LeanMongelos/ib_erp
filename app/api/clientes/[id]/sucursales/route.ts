import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { geocodificarSucursalPorId } from '@/lib/equipos/resolver-ubicacion-equipo'
import { sucursalInstalacionCreateSchema } from '@/lib/validation'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id: clienteId } = await params

    const sucursales = await prisma.clienteSucursal.findMany({
      where: { clienteId, activo: true },
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json(plain(sucursales))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('clientes.update', 'facturas.create')
    const { id: clienteId } = await params
    const data = sucursalInstalacionCreateSchema.parse(await req.json())

    const sucursal = await prisma.clienteSucursal.create({
      data: {
        clienteId,
        nombre: data.nombre,
        direccion: data.direccion ?? null,
        numero: data.numero ?? null,
        ciudad: data.ciudad ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        notas: data.notas ?? null,
        activo: data.activo ?? true,
      },
    })

    if (sucursal.lat == null && (sucursal.direccion || sucursal.ciudad)) {
      await geocodificarSucursalPorId(sucursal.id, { force: true }).catch(() => null)
    }

    const actualizada = await prisma.clienteSucursal.findUnique({ where: { id: sucursal.id } })
    return NextResponse.json(plain(actualizada ?? sucursal), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
