import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { getEquipoHistoriaCompleta } from '@/lib/equipos/historia-clinica'
import { prisma } from '@/lib/prisma'
import { plain } from '@/lib/serialize'

const equipoPatchSchema = z.object({
  nombre: z.string().min(1).optional(),
  marca: z.string().optional().nullable(),
  modelo: z.string().optional().nullable(),
  modeloExacto: z.string().optional().nullable(),
  codigoInterno: z.string().optional().nullable(),
  firmwareVersion: z.string().optional().nullable(),
  softwareVersion: z.string().optional().nullable(),
  servicioInstalacion: z.string().optional().nullable(),
  pisoSala: z.string().optional().nullable(),
  contactoResponsable: z.string().optional().nullable(),
  notasTecnicas: z.string().optional().nullable(),
  referenciaCompra: z.string().optional().nullable(),
  proveedorOrigenId: z.string().optional().nullable(),
  fechaInstalacion: z.coerce.date().optional().nullable(),
  direccionUbicacion: z.string().optional().nullable(),
  sucursalId: z.string().min(1).optional().nullable(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const data = await getEquipoHistoriaCompleta(id)
    if (!data) throw new ApiError(404, 'Equipo no encontrado')
    return NextResponse.json(plain(data))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('servicio.update')
    const { id } = await params
    const body = equipoPatchSchema.parse(await req.json())

    const anterior = await prisma.equipo.findUnique({
      where: { id },
      select: { direccionUbicacion: true, sucursalId: true },
    })

    const equipo = await prisma.equipo.update({
      where: { id },
      data: body,
    })

    const cambioUbicacion =
      (body.direccionUbicacion !== undefined && body.direccionUbicacion !== anterior?.direccionUbicacion) ||
      (body.sucursalId !== undefined && body.sucursalId !== anterior?.sucursalId)

    if (cambioUbicacion) {
      const { geocodificarEquipoPorId } = await import('@/lib/equipos/resolver-ubicacion-equipo')
      await geocodificarEquipoPorId(id, { force: true }).catch(() => null)
    }

    const actualizado = await prisma.equipo.findUnique({ where: { id } })
    return NextResponse.json(plain(actualizado ?? equipo))
  } catch (error) {
    return handleApiError(error)
  }
}
