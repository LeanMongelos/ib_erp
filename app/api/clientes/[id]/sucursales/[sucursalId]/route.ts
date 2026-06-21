import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { geocodificarSucursalPorId } from '@/lib/equipos/resolver-ubicacion-equipo'
import { geocodificarEquipoPorId } from '@/lib/equipos/resolver-ubicacion-equipo'

const patchSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  direccion: z.string().trim().max(200).optional().nullable(),
  numero: z.string().trim().max(20).optional().nullable(),
  ciudad: z.string().trim().max(100).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
  activo: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sucursalId: string }> },
) {
  try {
    await requirePermission('clientes.update')
    const { id: clienteId, sucursalId } = await params
    const data = patchSchema.parse(await req.json())

    const existente = await prisma.clienteSucursal.findFirst({
      where: { id: sucursalId, clienteId },
    })
    if (!existente) throw new ApiError(404, 'Sucursal no encontrada')

    const cambioDireccion =
      (data.direccion !== undefined && data.direccion !== existente.direccion) ||
      (data.numero !== undefined && data.numero !== existente.numero) ||
      (data.ciudad !== undefined && data.ciudad !== existente.ciudad)

    const sucursal = await prisma.clienteSucursal.update({
      where: { id: sucursalId },
      data,
    })

    if (cambioDireccion && data.lat == null && (sucursal.direccion || sucursal.ciudad)) {
      await geocodificarSucursalPorId(sucursalId, { force: true }).catch(() => null)
      const equipos = await prisma.equipo.findMany({
        where: { sucursalId },
        select: { id: true },
      })
      for (const eq of equipos) {
        await geocodificarEquipoPorId(eq.id, { force: true }).catch(() => null)
      }
    }

    const actualizada = await prisma.clienteSucursal.findUnique({ where: { id: sucursalId } })
    return NextResponse.json(plain(actualizada ?? sucursal))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sucursalId: string }> },
) {
  try {
    await requirePermission('clientes.update')
    const { id: clienteId, sucursalId } = await params

    const existente = await prisma.clienteSucursal.findFirst({
      where: { id: sucursalId, clienteId },
    })
    if (!existente) throw new ApiError(404, 'Sucursal no encontrada')

    await prisma.clienteSucursal.update({
      where: { id: sucursalId },
      data: { activo: false },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
