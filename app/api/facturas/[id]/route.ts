import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { itemFacturaSchema } from '@/lib/validation'
import { calcularTotales } from '@/lib/documentos'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

const facturaUpdateSchema = z.object({
  emisorId: z.string().min(1).optional().nullable(),
  plantillaId: z.string().min(1).optional().nullable(),
  tipo: z.enum(['A', 'B', 'C']).optional(),
  condicionPago: z.string().trim().max(60).optional(),
  observaciones: z.string().trim().max(2000).optional(),
  bonificacionPct: z.number().min(0).max(100).optional(),
  items: z.array(itemFacturaSchema).min(1).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Nada para actualizar' })

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('facturas.read')
    const { id } = await params
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: true,
        emisor: true,
        plantilla: true,
        presupuesto: { select: { id: true, numero: true } },
        ot: { select: { id: true, numero: true } },
        pagos: { include: { pago: true } },
      },
    })
    if (!factura) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(plain(factura))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('facturas.create')
    const { id } = await params
    const data = facturaUpdateSchema.parse(await req.json())

    const actual = await prisma.factura.findUnique({ where: { id }, include: { items: true } })
    if (!actual) throw new ApiError(404, 'Factura no encontrada')
    if (!['BORRADOR', 'RECHAZADA'].includes(actual.estado)) {
      throw new ApiError(400, 'Solo se pueden editar facturas en BORRADOR o RECHAZADA')
    }

    let updateData: Record<string, unknown> = {
      emisorId: data.emisorId,
      plantillaId: data.plantillaId,
      tipo: data.tipo,
      condicionPago: data.condicionPago,
      observaciones: data.observaciones,
      bonificacionPct: data.bonificacionPct,
      ...(actual.estado === 'RECHAZADA' ? { estado: 'BORRADOR' } : {}),
    }

    if (data.items) {
      const bonif = data.bonificacionPct ?? Number(actual.bonificacionPct)
      const { itemsCalculados, subtotal, iva, total } = calcularTotales(data.items, bonif)
      updateData = { ...updateData, subtotal, iva, total, bonificacionPct: bonif }
      await prisma.itemFactura.deleteMany({ where: { facturaId: id } })
      await prisma.itemFactura.createMany({
        data: itemsCalculados.map((i) => ({
          facturaId: id,
          codigo: i.codigo ?? null,
          descripcion: i.descripcion,
          descripcionLarga: i.descripcionLarga ?? null,
          fotoUrl: i.fotoUrl || null,
          cantidad: i.cantidad,
          precioUnit: i.precioUnit,
          bonificacionPct: i.bonificacionPct ?? 0,
          subtotal: i.subtotal,
          inventarioId: i.inventarioId ?? null,
        })),
      })
    }

    const factura = await prisma.factura.update({
      where: { id },
      data: updateData,
      include: { cliente: true, items: true, emisor: true },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'factura.update',
      entidad: 'Factura',
      entidadId: id,
      despues: data,
      ip: getIp(req),
    })

    return NextResponse.json(plain(factura))
  } catch (error) {
    return handleApiError(error)
  }
}
