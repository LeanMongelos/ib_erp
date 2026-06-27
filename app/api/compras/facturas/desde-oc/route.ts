import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { facturaCompraDesdeOcSchema } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { crearFacturaCompra } from '@/lib/compras/factura-compra-crud'
import {
  inferirTipoFacturaDesdeOC,
  ocEstaAprobada,
  prefillsDesdeOC,
} from '@/lib/compras/factura-compra'

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.invoice')
    const data = facturaCompraDesdeOcSchema.parse(await req.json())

    const oc = await prisma.ordenCompra.findUnique({
      where: { id: data.ordenCompraId },
      include: { items: true, proveedor: true },
    })
    if (!oc) throw new ApiError(404, 'Orden de compra no encontrada')
    if (!ocEstaAprobada(oc.estado)) {
      throw new ApiError(400, 'La orden de compra debe estar aprobada')
    }

    const tipo = data.tipo ?? inferirTipoFacturaDesdeOC(oc.items)
    const items = prefillsDesdeOC(oc, tipo)
    if (items.length === 0) {
      throw new ApiError(400, 'No hay ítems para facturar desde esta orden de compra')
    }

    const fecha = data.fecha ?? new Date()
    const puntoVenta = data.puntoVenta ?? 1
    const numeroComprobante = data.numeroComprobante ?? Math.floor(Date.now() % 900000) + 100000

    const fc = await crearFacturaCompra(actor.id, {
      proveedorId: oc.proveedorId,
      tipo,
      fecha,
      puntoVenta,
      numeroComprobante,
      tipoComprobanteAfipId: data.tipoComprobanteAfipId,
      moneda: oc.moneda,
      ordenCompraId: oc.id,
      items,
      registrar: data.registrar,
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: data.registrar ? 'fc_compra.registrar_desde_oc' : 'fc_compra.create_desde_oc',
      entidad: 'FacturaCompra',
      entidadId: fc.id,
      despues: { ordenCompraId: oc.id },
      ip: getIp(req),
    })

    return NextResponse.json(plain(fc), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
