import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { presupuestoUpdateSchema } from '@/lib/validation'
import { calcularTotalesPresupuesto } from '@/lib/presupuestos/calcular-total-presupuesto'
import { aplicarPreciosResueltosItems } from '@/lib/precios/aplicar-precios-documento'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { resolverCotizacionUsdDocumento, CotizacionUsdFaltanteError } from '@/lib/moneda'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('presupuestos.read')
    const { id } = await params
    const p = await prisma.presupuesto.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: { include: { inventario: { select: { id: true, tipoArticulo: true, esSerializado: true, requierePreventivo: true, intervaloPreventivoDias: true } } } },
        emisor: true,
        vendedor: { select: { nombre: true } },
        factura: true,
      },
    })
    if (!p) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(plain(p))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const data = presupuestoUpdateSchema.parse(body)

    if (data.estado === 'APROBADO') {
      const actor = await requirePermission('presupuestos.approve')
      const actual = await prisma.presupuesto.findUnique({ where: { id }, include: { factura: true } })
      if (!actual) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
      if (actual.factura) throw new ApiError(400, 'El presupuesto ya fue facturado')
      if (!['BORRADOR', 'ENVIADO'].includes(actual.estado)) {
        throw new ApiError(400, `No se puede aprobar desde estado ${actual.estado}`)
      }
      const p = await prisma.presupuesto.update({ where: { id }, data: { estado: 'APROBADO' } })
      await registrarAuditoria({
        usuarioId: actor.id,
        accion: 'presupuesto.approve',
        entidad: 'Presupuesto',
        entidadId: id,
        ip: getIp(req),
      })
      return NextResponse.json(plain(p))
    }

    const actor = await requirePermission('presupuestos.update')
    const actual = await prisma.presupuesto.findUnique({ where: { id } })
    if (!actual) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const enviando = data.estado === 'ENVIADO' && actual.estado !== 'ENVIADO'
    if (enviando && !tienePermiso(actor.permissions, 'presupuestos.send')) {
      throw new ApiError(403, 'No tenés permisos para enviar presupuestos')
    }

    const { items, moneda: monedaPatch, cotizacionUsd: cotizacionPatch, ...resto } = data

    const monedaFinal = monedaPatch ?? actual.moneda
    let cotizacionUsd: number | null | undefined = cotizacionPatch
    if (monedaPatch !== undefined || cotizacionPatch !== undefined) {
      try {
        cotizacionUsd = await resolverCotizacionUsdDocumento(
          prisma,
          monedaFinal,
          cotizacionPatch ?? actual.cotizacionUsd,
        )
      } catch (e) {
        if (e instanceof CotizacionUsdFaltanteError) throw new ApiError(400, e.message)
        throw e
      }
    }

    if (items) {
      if (!['BORRADOR', 'ENVIADO'].includes(actual.estado)) {
        throw new ApiError(400, 'Solo se pueden editar ítems en presupuestos BORRADOR o ENVIADO')
      }
      const monedaItems = monedaPatch ?? actual.moneda
      const itemsConPrecio = await aplicarPreciosResueltosItems(items, {
        clienteId: actual.clienteId,
        moneda: monedaItems,
      })
      const { itemsCalculados, subtotal, iva, interesFinanciacion, total } =
        calcularTotalesPresupuesto({
          items: itemsConPrecio,
          bonificacionPct: actual.bonificacionPct ?? 0,
          alicuotaIvaPct: actual.alicuotaIvaPct ?? 21,
          condicionPago: actual.condicionPago,
          tasaFinanciacionPct: actual.tasaFinanciacionPct ?? 0,
        })
      const p = await prisma.$transaction(async (tx) => {
        await tx.itemPresupuesto.deleteMany({ where: { presupuestoId: id } })
        return tx.presupuesto.update({
          where: { id },
          data: {
            ...resto,
            ...(monedaPatch !== undefined ? { moneda: monedaFinal } : {}),
            ...(monedaPatch !== undefined || cotizacionPatch !== undefined
              ? { cotizacionUsd: cotizacionUsd ?? null }
              : {}),
            subtotal,
            iva,
            interesFinanciacion,
            total,
            items: {
              create: itemsCalculados.map((i) => ({
                codigo: i.codigo ?? null,
                descripcion: i.descripcion,
                descripcionLarga: i.descripcionLarga ?? null,
                fotoUrl: i.fotoUrl || null,
                cantidad: i.cantidad,
                precioUnit: i.precioUnit,
                bonificacionPct: i.bonificacionPct ?? 0,
                alicuotaIvaPct: i.alicuotaIvaPct ?? null,
                subtotal: i.subtotal,
                inventarioId: i.inventarioId ?? null,
                numeroSerie: i.numeroSerie?.trim() || null,
                proximoPreventivo: i.proximoPreventivo ?? null,
              })),
            },
          },
          include: { items: true },
        })
      })
      await registrarAuditoria({
        usuarioId: actor.id, accion: 'presupuesto.update', entidad: 'Presupuesto', entidadId: id, despues: data, ip: getIp(req),
      })
      return NextResponse.json(plain(p))
    }

    const p = await prisma.presupuesto.update({
      where: { id },
      data: {
        ...resto,
        ...(monedaPatch !== undefined ? { moneda: monedaFinal } : {}),
        ...(monedaPatch !== undefined || cotizacionPatch !== undefined
          ? { cotizacionUsd: cotizacionUsd ?? null }
          : {}),
      },
    })
    await registrarAuditoria({
      usuarioId: actor.id, accion: 'presupuesto.update', entidad: 'Presupuesto', entidadId: id, despues: data, ip: getIp(req),
    })
    if (enviando) {
      void import('@/lib/presupuestos/notify-cliente-enviado').then(({ notifyClientePresupuestoEnviado }) =>
        notifyClientePresupuestoEnviado(id).catch(() => null),
      )
    }
    return NextResponse.json(plain(p))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('presupuestos.delete')
    const { id } = await params
    const p = await prisma.presupuesto.findUnique({ where: { id } })
    if (!p) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (!['BORRADOR', 'RECHAZADO', 'VENCIDO'].includes(p.estado)) {
      throw new ApiError(400, 'Solo se pueden eliminar presupuestos en BORRADOR, RECHAZADO o VENCIDO')
    }
    await prisma.presupuesto.delete({ where: { id } })
    await registrarAuditoria({
      usuarioId: actor.id, accion: 'presupuesto.delete', entidad: 'Presupuesto', entidadId: id, ip: getIp(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
