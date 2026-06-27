import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { constatarComprobanteCompra, cuitReceptorEmpresa } from '@/lib/afip/constatar-comprobante'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('compras.invoice')
    const { id } = await params

    const fc = await prisma.facturaCompra.findUnique({
      where: { id },
      include: {
        proveedor: { select: { cuit: true, razonSocial: true } },
        tipoComprobanteAfip: { select: { codigoAfip: true } },
      },
    })
    if (!fc) return NextResponse.json({ error: 'Factura de compra no encontrada' }, { status: 404 })
    if (!fc.cae?.trim()) {
      return NextResponse.json({ error: 'Cargá el CAE antes de constatar' }, { status: 400 })
    }
    if (!fc.proveedor.cuit) {
      return NextResponse.json({ error: 'El proveedor no tiene CUIT cargado' }, { status: 400 })
    }

    const cuitReceptor = await cuitReceptorEmpresa()
    if (!cuitReceptor) {
      return NextResponse.json({ error: 'No hay emisor fiscal configurado (CUIT receptor)' }, { status: 400 })
    }

    const tipoCbte = fc.tipoComprobanteAfip?.codigoAfip ?? 1
    const resultado = await constatarComprobanteCompra({
      cuitEmisor: fc.proveedor.cuit,
      tipoComprobante: tipoCbte,
      puntoVenta: fc.puntoVenta,
      numeroComprobante: fc.numeroComprobante,
      fecha: fc.fecha,
      importeTotal: fc.total,
      cae: fc.cae,
      cuitReceptor,
    })

    const updated = await prisma.facturaCompra.update({
      where: { id },
      data: {
        constatacionResultado: resultado.resultado ?? (resultado.ok ? 'A' : 'R'),
        constatadoEn: new Date(),
        constatacionObservaciones: resultado.observaciones ?? null,
      },
      include: {
        proveedor: { select: { id: true, razonSocial: true, cuit: true } },
        tipoComprobanteAfip: { select: { id: true, codigoAfip: true, letra: true } },
        vencimientos: { orderBy: { numeroCuota: 'asc' } },
      },
    })

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'fc_compra.constatar',
      entidad: 'FacturaCompra',
      entidadId: id,
      despues: { resultado: updated.constatacionResultado },
      ip: getIp(req),
    })

    return NextResponse.json(plain({ ...updated, constatacion: resultado }))
  } catch (error) {
    return handleApiError(error)
  }
}
