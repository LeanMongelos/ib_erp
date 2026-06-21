import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { calcularMetricasCliente } from '@/lib/clientes-metrics'

/**
 * GET /api/clientes/[id]/metricas
 * Detalle 360° de comportamiento del cliente: métricas derivadas, historial de
 * compras (facturas) e ítems más comprados. Todo se calcula on-demand a partir
 * de las facturas existentes.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('clientes.read')
    const { id } = await params

    const cliente = await prisma.cliente.findUnique({
      where: { id },
      select: { id: true, nombre: true, limiteCredito: true },
    })
    if (!cliente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const facturas = await prisma.factura.findMany({
      where: { clienteId: id },
      orderBy: { fechaEmision: 'desc' },
      include: { items: true },
    })

    const metricas = calcularMetricasCliente(
      facturas.map((f) => ({
        estado: f.estado,
        total: Number(f.total),
        fechaEmision: f.fechaEmision,
        fechaVencimiento: f.fechaVencimiento,
        items: f.items.map((it) => ({
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          subtotal: Number(it.subtotal),
        })),
      })),
      { limiteCredito: cliente.limiteCredito },
    )

    return NextResponse.json({ cliente: { id: cliente.id, nombre: cliente.nombre }, metricas })
  } catch (error) {
    return handleApiError(error)
  }
}
