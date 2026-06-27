import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { facturaCompraUpdateSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { actualizarFacturaCompraBorrador, fcInclude } from '@/lib/compras/factura-compra-crud'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('compras.read')
    const { id } = await params
    const fc = await prisma.facturaCompra.findUnique({ where: { id }, include: fcInclude })
    if (!fc) return NextResponse.json({ error: 'Factura de compra no encontrada' }, { status: 404 })
    return NextResponse.json(plain(fc))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.invoice')
    const { id } = await params
    const data = facturaCompraUpdateSchema.parse(await req.json())

    const fc = await actualizarFacturaCompraBorrador(id, {
      proveedorId: data.proveedorId,
      tipo: data.tipo,
      fecha: data.fecha,
      fechaVencimiento: data.fechaVencimiento,
      puntoVenta: data.puntoVenta,
      numeroComprobante: data.numeroComprobante,
      tipoComprobanteAfipId: data.tipoComprobanteAfipId,
      moneda: data.moneda,
      ordenCompraId: data.ordenCompraId,
      fcSinRecepcion: data.fcSinRecepcion,
      notaFcSinRecepcion: data.notaFcSinRecepcion,
      notaMonedaOc: data.notaMonedaOc,
      cae: data.cae,
      caeVencimiento: data.caeVencimiento,
      items: data.items,
      cuotas: data.cuotas,
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'fc_compra.update',
      entidad: 'FacturaCompra',
      entidadId: id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(fc))
  } catch (error) {
    return handleApiError(error)
  }
}
