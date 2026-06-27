import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { facturaCompraCreateSchema, estadoFacturaCompraEnum, tipoFacturaCompraEnum } from '@/lib/validation'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { crearFacturaCompra, fcInclude } from '@/lib/compras/factura-compra-crud'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('compras.read')
    const { searchParams } = new URL(req.url)
    const proveedorId = searchParams.get('proveedorId')?.trim() ?? ''
    const estadoRaw = searchParams.get('estado') ?? ''
    const tipoRaw = searchParams.get('tipo') ?? ''
    const ordenCompraId = searchParams.get('ordenCompraId')?.trim() ?? ''

    const estado = estadoFacturaCompraEnum.safeParse(estadoRaw).success ? estadoRaw : ''
    const tipo = tipoFacturaCompraEnum.safeParse(tipoRaw).success ? tipoRaw : ''

    const facturas = await prisma.facturaCompra.findMany({
      where: {
        ...(proveedorId && { proveedorId }),
        ...(ordenCompraId && { ordenCompraId }),
        ...(estado && { estado: estado as Prisma.EnumEstadoFacturaCompraFilter['equals'] }),
        ...(tipo && { tipo: tipo as Prisma.EnumTipoFacturaCompraFilter['equals'] }),
      },
      orderBy: { fecha: 'desc' },
      include: fcInclude,
    })

    return NextResponse.json(plain(facturas))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('compras.invoice')
    const data = facturaCompraCreateSchema.parse(await req.json())

    const fc = await crearFacturaCompra(actor.id, {
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
      registrar: data.registrar,
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: data.registrar ? 'fc_compra.registrar' : 'fc_compra.create',
      entidad: 'FacturaCompra',
      entidadId: fc.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(fc), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
