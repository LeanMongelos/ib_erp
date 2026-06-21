import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

const LIMITE = 12

/** Historial reciente de productos (facturas) y servicio técnico (OTs) para la bandeja CRM */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('crm.read', 'clientes.read')
    const { id } = await params

    const cliente = await prisma.cliente.findUnique({
      where: { id },
      select: { id: true, nombre: true, activo: true },
    })
    if (!cliente || !cliente.activo) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const [ots, facturas] = await Promise.all([
      prisma.ordenTrabajo.findMany({
        where: { clienteId: id },
        orderBy: { fechaApertura: 'desc' },
        take: LIMITE,
        select: {
          id: true,
          numero: true,
          descripcion: true,
          tipo: true,
          estado: true,
          fechaApertura: true,
          fechaCierre: true,
          equipo: { select: { nombre: true } },
        },
      }),
      prisma.factura.findMany({
        where: {
          clienteId: id,
          estado: { notIn: ['BORRADOR', 'ANULADA'] },
        },
        orderBy: { fechaEmision: 'desc' },
        take: 8,
        select: {
          id: true,
          numero: true,
          fechaEmision: true,
          moneda: true,
          items: {
            select: {
              id: true,
              descripcion: true,
              cantidad: true,
              subtotal: true,
              inventarioId: true,
              equipoGeneradoId: true,
            },
            take: 20,
          },
        },
      }),
    ])

    const servicios = ots.map((ot) => ({
      id: ot.id,
      numero: ot.numero,
      descripcion: ot.descripcion,
      tipo: ot.tipo,
      estado: ot.estado,
      equipo: ot.equipo?.nombre ?? null,
      fecha: (ot.fechaCierre ?? ot.fechaApertura).toISOString(),
    }))

    const productos: Array<{
      itemFacturaId: string
      descripcion: string
      cantidad: number
      subtotal: number
      moneda: string
      facturaId: string
      facturaNumero: string
      fecha: string
      inventarioId: string | null
      equipoId: string | null
    }> = []

    for (const f of facturas) {
      for (const item of f.items) {
        productos.push({
          itemFacturaId: item.id,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          subtotal: Number(item.subtotal),
          moneda: f.moneda ?? 'ARS',
          facturaId: f.id,
          facturaNumero: f.numero,
          fecha: f.fechaEmision.toISOString(),
          inventarioId: item.inventarioId,
          equipoId: item.equipoGeneradoId,
        })
        if (productos.length >= LIMITE) break
      }
      if (productos.length >= LIMITE) break
    }

    return NextResponse.json(plain({ servicios, productos }))
  } catch (error) {
    return handleApiError(error)
  }
}
