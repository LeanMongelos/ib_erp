import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError } from '@/lib/api-auth'
import { clienteUpdateSchema } from '@/lib/validation'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { geocodificarCliente } from '@/lib/clientes/geocodificar-cliente'
import { refrescarUbicacionEquiposCliente } from '@/lib/tracking-automation'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params

    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        equipos: true,
        ots: { orderBy: { creadoEn: 'desc' }, take: 20, include: { tecnico: true } },
        facturas: { orderBy: { creadoEn: 'desc' }, take: 10 },
        _count: { select: { equipos: true, ots: true } },
      },
    })
    if (!cliente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(cliente)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('clientes.update')
    const { id } = await params

    const body = await req.json()
    const parsed = clienteUpdateSchema.parse(body)
    const { sucursales: _sucursales, ...data } = parsed

    const anterior = await prisma.cliente.findUnique({
      where: { id },
      select: { direccion: true, ciudad: true },
    })

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...data,
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.alicuotaIvaId !== undefined && { alicuotaIvaId: data.alicuotaIvaId }),
        ...(data.listaPreciosId !== undefined && { listaPreciosId: data.listaPreciosId }),
        ...(data.esMayorista !== undefined && { esMayorista: data.esMayorista }),
        ...(data.monedaPreferida !== undefined && { monedaPreferida: data.monedaPreferida }),
      },
    })

    const cambioDireccion =
      (data.direccion !== undefined && data.direccion !== anterior?.direccion) ||
      (data.ciudad !== undefined && data.ciudad !== anterior?.ciudad)

    if (cambioDireccion && (cliente.direccion || cliente.ciudad)) {
      await geocodificarCliente(cliente, { force: true }).catch(() => null)
      await refrescarUbicacionEquiposCliente(id).catch(() => null)
    }

    const clienteActualizado = await prisma.cliente.findUnique({ where: { id } })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'cliente.update',
      entidad: 'Cliente',
      entidadId: id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(clienteActualizado ?? cliente)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('clientes.deactivate')
    const { id } = await params

    // Soft delete: marcamos inactivo en lugar de borrar para conservar histórico
    await prisma.cliente.update({ where: { id }, data: { activo: false } })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'cliente.deactivate',
      entidad: 'Cliente',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
