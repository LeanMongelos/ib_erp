import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { facturaCreateSchema } from '@/lib/validation'
import { calcularTotales } from '@/lib/documentos'
import { siguienteNumeroFactura, crearConNumeroUnico } from '@/lib/sequences'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'
import { parsePlazosCobranza, formatCondicionPago } from '@/lib/cobranzas/plazos'
import { sincronizarVencimientosCobranza } from '@/lib/cobranzas/vencimientos'
import { resolverCotizacionUsdDocumento, CotizacionUsdFaltanteError } from '@/lib/moneda'
import { validarSucursalesInstalacionEquipo } from '@/lib/facturas/validar-sucursal-equipo'

export async function GET() {
  try {
    await requireAuth()
    const facturas = await prisma.factura.findMany({
      orderBy: { creadoEn: 'desc' },
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
    let otId = data.otId ?? null

    let emisorId = data.emisorId ?? null
    if (!emisorId) {
      const def = await prisma.emisor.findFirst({ where: { predeterminado: true, activo: true } })
      emisorId = def?.id ?? null
    }

    const { itemsCalculados, subtotal, iva, total, alicuotaIvaPct } = calcularTotales(
      data.items,
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

    let moneda = data.moneda ?? 'ARS'
    let cotizacionExplicita = data.cotizacionUsd ?? null

    if (data.presupuestoId) {
      const pres = await prisma.presupuesto.findUnique({
        where: { id: data.presupuestoId },
        include: { factura: true },
      })
      if (!pres) throw new ApiError(404, 'Presupuesto no encontrado')
      if (pres.estado !== 'APROBADO') {
        throw new ApiError(400, 'El presupuesto debe estar aprobado para facturar')
      }
      if (pres.factura) throw new ApiError(400, 'Este presupuesto ya fue facturado')
      if (data.clienteId !== pres.clienteId) {
        throw new ApiError(400, 'El cliente debe coincidir con el del presupuesto')
      }
      if (pres.otId && !otId) otId = pres.otId
      if (!data.moneda) moneda = pres.moneda as typeof moneda
      if (cotizacionExplicita == null) cotizacionExplicita = pres.cotizacionUsd
    }

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

    if (data.presupuestoId && otId) {
      const pres = await prisma.presupuesto.findUnique({ where: { id: data.presupuestoId } })
      if (pres?.otId && pres.otId !== otId) {
        throw new ApiError(400, 'La OT no coincide con la del presupuesto')
      }
    }

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
            plantillaId: data.plantillaId ?? null,
            otId,
            presupuestoId: data.presupuestoId ?? null,
            condicionPago,
            observaciones: data.observaciones ?? null,
            puntoVenta: emisorId
              ? undefined
              : undefined,
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
                numeroSerie: i.numeroSerie ?? null,
                proximoPreventivo: i.proximoPreventivo ? new Date(i.proximoPreventivo as string | Date) : null,
                sucursalInstalacionId: i.sucursalInstalacionId ?? null,
              })),
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

    if (data.presupuestoId) {
      await prisma.presupuesto.update({
        where: { id: data.presupuestoId },
        data: { estado: 'CONVERTIDO' },
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

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'factura.create',
      entidad: 'Factura',
      entidadId: factura.id,
      despues: data.presupuestoId ? { presupuestoId: data.presupuestoId } : undefined,
      ip: getIp(req),
    })

    return NextResponse.json(plain(facturaCompleta ?? factura), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
