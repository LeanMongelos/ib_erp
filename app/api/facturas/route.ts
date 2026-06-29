import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermissionAny, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { facturaCreateSchema } from '@/lib/validation'
import { calcularTotales } from '@/lib/documentos'
import { siguienteNumeroFactura, crearConNumeroUnico } from '@/lib/sequences'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { parsePlazosCobranza, formatCondicionPago } from '@/lib/cobranzas/plazos'
import { sincronizarVencimientosCobranza } from '@/lib/cobranzas/vencimientos'
import { resolverCotizacionUsdDocumento, CotizacionUsdFaltanteError } from '@/lib/moneda'
import { validarSucursalesInstalacionEquipo } from '@/lib/facturas/validar-sucursal-equipo'
import { validarUnidadesInventarioFactura } from '@/lib/facturas/validar-unidades-inventario'
import { datosItemsFacturaNestedCreate } from '@/lib/facturas/datos-items-factura'
import { aplicarPreciosResueltosItems } from '@/lib/precios/aplicar-precios-documento'
import { resolverPlantillaIdEmision } from '@/lib/plantillas/resolver-plantilla'
import { sincronizarEmbudoAlFacturarPresupuesto } from '@/lib/crm/embudo-sincronizar-presupuesto'

export async function GET(req: NextRequest) {
  try {
    await requirePermissionAny('facturas.read', 'cobranzas.read')
    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('clienteId')

    const facturas = await prisma.factura.findMany({
      where: clienteId ? { clienteId } : undefined,
      orderBy: { creadoEn: 'desc' },
      take: clienteId ? 50 : undefined,
      include: {
        cliente: { select: { nombre: true } },
        emisor: { select: { razonSocial: true, cuit: true } },
        vencimientos: { orderBy: { numeroCuota: 'asc' } },
      },
    })
    return NextResponse.json(plain(facturas))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('facturas.create')
    const body = await req.json()
    const data = facturaCreateSchema.parse(body)
    await validarSucursalesInstalacionEquipo(data.clienteId, data.items)
    await validarUnidadesInventarioFactura(data.items)

    let otId = data.otId ?? null

    let emisorId = data.emisorId ?? null
    if (!emisorId) {
      const def = await prisma.emisor.findFirst({ where: { predeterminado: true, activo: true } })
      emisorId = def?.id ?? null
    }

    let moneda = data.moneda ?? 'ARS'
    let cotizacionExplicita = data.cotizacionUsd ?? null

    if (data.presupuestoId) {
      const pres = await prisma.presupuesto.findUnique({
        where: { id: data.presupuestoId },
        include: { factura: true },
      })
      if (!pres) throw new ApiError(404, 'Presupuesto no encontrado')
      if (pres.estado !== 'APROBADO' && pres.estado !== 'CONVERTIDO') {
        throw new ApiError(400, 'El presupuesto debe estar aprobado para facturar')
      }
      if (pres.factura && pres.factura.id !== undefined && !data.remitoId) {
        throw new ApiError(400, 'Este presupuesto ya fue facturado')
      }
      if (data.clienteId !== pres.clienteId) {
        throw new ApiError(400, 'El cliente debe coincidir con el del presupuesto')
      }
      if (pres.otId && !otId) otId = pres.otId
      if (!data.moneda) moneda = pres.moneda as typeof moneda
      if (cotizacionExplicita == null) cotizacionExplicita = pres.cotizacionUsd

      if (!data.remitoId) {
        const { mensajeFacturaRequiereRemito } = await import('@/lib/facturas/validar-flujo-remito')
        const msg = await mensajeFacturaRequiereRemito({ presupuestoId: data.presupuestoId })
        if (msg) throw new ApiError(400, msg)
      }
    }

    let ordenVentaId = data.ordenVentaId ?? null
    let remitoId = data.remitoId ?? null
    let presupuestoId = data.presupuestoId ?? null

    if (data.remitoId) {
      const { itemsFacturaDesdeRemito } = await import('@/lib/remitos/venta')
      const desdeRemito = await itemsFacturaDesdeRemito(data.remitoId)
      if (data.clienteId !== desdeRemito.clienteId) {
        throw new ApiError(400, 'El cliente debe coincidir con el del remito')
      }
      ordenVentaId = desdeRemito.ordenVentaId ?? ordenVentaId
      presupuestoId = presupuestoId ?? desdeRemito.presupuestoId
      remitoId = desdeRemito.remitoId
    }

    const itemsConPrecio = await aplicarPreciosResueltosItems(data.items, {
      clienteId: data.clienteId,
      moneda,
    })

    const { itemsCalculados, subtotal, iva, total, alicuotaIvaPct } = calcularTotales(
      itemsConPrecio,
      data.bonificacionPct ?? 0,
      data.alicuotaIvaPct ?? 21,
    )

    const plazos =
      data.plazosCobranza?.length
        ? parsePlazosCobranza(data.plazosCobranza)
        : parsePlazosCobranza(data.condicionPago)
    const condicionPago =
      data.condicionPago?.trim() ||
      (plazos.length > 0 ? formatCondicionPago(plazos) : null)

    let cotizacionUsd: number | null = null
    try {
      cotizacionUsd = await resolverCotizacionUsdDocumento(prisma, moneda, cotizacionExplicita)
    } catch (e) {
      if (e instanceof CotizacionUsdFaltanteError) throw new ApiError(400, e.message)
      throw e
    }

    if (otId) {
      const facturaOt = await prisma.factura.findUnique({ where: { otId } })
      if (facturaOt) throw new ApiError(400, 'Esta orden de trabajo ya fue facturada')
    }

    if (presupuestoId && otId) {
      const pres = await prisma.presupuesto.findUnique({ where: { id: presupuestoId } })
      if (pres?.otId && pres.otId !== otId) {
        throw new ApiError(400, 'La OT no coincide con la del presupuesto')
      }
    }

    const plantillaId = await resolverPlantillaIdEmision('FACTURA', data.plantillaId ?? null)

    const factura = await crearConNumeroUnico(
      () => siguienteNumeroFactura(data.tipo),
      (numero) =>
        prisma.factura.create({
          data: {
            numero,
            tipo: data.tipo,
            estado: data.estado ?? 'BORRADOR',
            subtotal,
            iva,
            total,
            moneda,
            cotizacionUsd,
            bonificacionPct: data.bonificacionPct ?? 0,
            alicuotaIvaPct,
            clienteId: data.clienteId,
            emisorId,
            plantillaId,
            otId,
            presupuestoId,
            ordenVentaId,
            remitoId,
            condicionPago,
            observaciones: data.observaciones ?? null,
            puntoVenta: emisorId
              ? undefined
              : undefined,
            items: {
              create: datosItemsFacturaNestedCreate(
                itemsCalculados,
                data.items.map((i) => ({
                  numeroSerie: i.numeroSerie,
                  proximoPreventivo: i.proximoPreventivo,
                  sucursalInstalacionId: i.sucursalInstalacionId,
                  inventarioUnidadId: i.inventarioUnidadId,
                })),
              ),
            },
          },
          include: { cliente: true, items: true, emisor: true },
        }),
    )

    if (emisorId) {
      const em = await prisma.emisor.findUnique({ where: { id: emisorId }, select: { puntoVenta: true } })
      if (em) {
        await prisma.factura.update({ where: { id: factura.id }, data: { puntoVenta: em.puntoVenta } })
      }
    }

    if (plazos.length > 0) {
      await sincronizarVencimientosCobranza(factura.id, plazos)
    }

    if (presupuestoId) {
      await prisma.presupuesto.update({
        where: { id: presupuestoId },
        data: { estado: 'CONVERTIDO' },
      })
      await sincronizarEmbudoAlFacturarPresupuesto(
        presupuestoId,
        factura.id,
        factura.numero,
        actor.id,
      ).catch(() => null)
    }

    if (remitoId) {
      await prisma.remitoVenta.update({
        where: { id: remitoId },
        data: { estado: 'FACTURADO' },
      })
    }
    if (ordenVentaId) {
      await prisma.ordenVenta.update({
        where: { id: ordenVentaId },
        data: { estado: 'FACTURADA' },
      })
    }

    const facturaCompleta = await prisma.factura.findUnique({
      where: { id: factura.id },
      include: {
        cliente: true,
        items: true,
        emisor: true,
        vencimientos: { orderBy: { numeroCuota: 'asc' } },
      },
    })

    if (presupuestoId && otId) {
      const { aplicarGarantiaPresupuestoEquipoOt } = await import('@/lib/garantia')
      await aplicarGarantiaPresupuestoEquipoOt({
        presupuestoId,
        otId,
        usuarioId: actor.id,
      }).catch(() => null)
    }

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'factura.create',
      entidad: 'Factura',
      entidadId: factura.id,
      despues: presupuestoId ? { presupuestoId, remitoId, ordenVentaId } : undefined,
      ip: getIp(req),
    })

    return NextResponse.json(plain(facturaCompleta ?? factura), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
