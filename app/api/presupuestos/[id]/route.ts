import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { tienePermiso } from '@/lib/rbac'
import { presupuestoUpdateSchema } from '@/lib/validation'
import { aplicarPreciosResueltosItems } from '@/lib/precios/aplicar-precios-documento'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { resolverCotizacionUsdDocumento, CotizacionUsdFaltanteError } from '@/lib/moneda'
import { formatCondicionPago, parsePlazosCobranza } from '@/lib/cobranzas/plazos'
import { presupuestoEditable, recalcularPresupuestoDesdeItems } from '@/lib/presupuestos/revision'

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
    const actual = await prisma.presupuesto.findUnique({
      where: { id },
      include: { factura: { select: { id: true } }, items: true },
    })
    if (!actual) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (actual.factura) throw new ApiError(400, 'No se puede editar un presupuesto ya facturado')
    if (actual.estado === 'CONVERTIDO') throw new ApiError(400, 'No se puede editar un presupuesto convertido')

    const enviando = data.estado === 'ENVIADO' && actual.estado !== 'ENVIADO'
    if (enviando && !tienePermiso(actor.permissions, 'presupuestos.send')) {
      throw new ApiError(403, 'No tenés permisos para enviar presupuestos')
    }

    const editandoContenido =
      data.items !== undefined ||
      data.condicionPago !== undefined ||
      data.plazosCobranza !== undefined ||
      data.tasaFinanciacionPct !== undefined ||
      data.bonificacionPct !== undefined ||
      data.alicuotaIvaPct !== undefined

    if (editandoContenido && !presupuestoEditable(actual.estado, Boolean(actual.factura))) {
      throw new ApiError(
        400,
        'Solo se pueden editar ítems y condiciones en presupuestos BORRADOR o ENVIADO. Creá una revisión para modificar uno aprobado.',
      )
    }

    const { items, moneda: monedaPatch, cotizacionUsd: cotizacionPatch, plazosCobranza, ...resto } = data

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
      const monedaItems = monedaPatch ?? actual.moneda
      const itemsConPrecio = await aplicarPreciosResueltosItems(items, {
        clienteId: actual.clienteId,
        moneda: monedaItems,
      })
      const plazos =
        plazosCobranza?.length
          ? plazosCobranza
          : data.condicionPago
            ? parsePlazosCobranza(data.condicionPago)
            : parsePlazosCobranza(actual.condicionPago)
      const condicionPago =
        data.condicionPago?.trim() ||
        (plazos.length > 0 ? formatCondicionPago(plazos) : actual.condicionPago)

      const { itemsCalculados, subtotal, iva, interesFinanciacion, total, alicuotaIvaPct } =
        recalcularPresupuestoDesdeItems({
          items: itemsConPrecio,
          bonificacionPct: data.bonificacionPct ?? actual.bonificacionPct ?? 0,
          alicuotaIvaPct: data.alicuotaIvaPct ?? actual.alicuotaIvaPct ?? 21,
          condicionPago,
          plazosCobranza: plazos,
          tasaFinanciacionPct: data.tasaFinanciacionPct ?? actual.tasaFinanciacionPct ?? 0,
          interesFinanciacion: data.interesFinanciacion ?? actual.interesFinanciacion ?? 0,
        })
      const p = await prisma.$transaction(async (tx) => {
        await tx.itemPresupuesto.deleteMany({ where: { presupuestoId: id } })
        return tx.presupuesto.update({
          where: { id },
          data: {
            ...resto,
            condicionPago,
            tasaFinanciacionPct: data.tasaFinanciacionPct ?? actual.tasaFinanciacionPct,
            interesFinanciacion,
            alicuotaIvaPct,
            bonificacionPct: data.bonificacionPct ?? actual.bonificacionPct,
            ...(monedaPatch !== undefined ? { moneda: monedaFinal } : {}),
            ...(monedaPatch !== undefined || cotizacionPatch !== undefined
              ? { cotizacionUsd: cotizacionUsd ?? null }
              : {}),
            ...(data.vigenciaDias !== undefined
              ? {
                  fechaVencimiento: (() => {
                    const vence = new Date(actual.fechaEmision)
                    vence.setDate(vence.getDate() + data.vigenciaDias!)
                    return vence
                  })(),
                }
              : {}),
            subtotal,
            iva,
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

    if (data.vigenciaDias !== undefined || data.garantia !== undefined) {
      const bloqueado = await prisma.presupuesto.findUnique({
        where: { id },
        include: { factura: true, ordenVenta: { include: { remitos: { take: 1 } } } },
      })
      if (bloqueado?.factura) {
        throw new ApiError(400, 'No se puede modificar vigencia/garantía: el presupuesto ya fue facturado')
      }
      if (bloqueado?.estado === 'CONVERTIDO') {
        throw new ApiError(400, 'No se puede modificar vigencia/garantía en un presupuesto convertido')
      }
      if ((bloqueado?.ordenVenta?.remitos?.length ?? 0) > 0) {
        throw new ApiError(400, 'No se puede modificar vigencia/garantía: ya tiene remito generado')
      }
    }

    const p = await prisma.presupuesto.update({
      where: { id },
      data: {
        ...resto,
        ...(data.vigenciaDias !== undefined
          ? {
              fechaVencimiento: (() => {
                const vence = new Date(actual.fechaEmision)
                vence.setDate(vence.getDate() + data.vigenciaDias!)
                return vence
              })(),
            }
          : {}),
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
