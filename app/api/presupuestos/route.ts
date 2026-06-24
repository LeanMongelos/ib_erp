import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requirePermission, handleApiError, ApiError } from '@/lib/api-auth'
import { presupuestoCreateSchema } from '@/lib/validation'
import { calcularTotalesPresupuesto } from '@/lib/presupuestos/calcular-total-presupuesto'
import { aplicarPreciosResueltosItems } from '@/lib/precios/aplicar-precios-documento'
import { formatCondicionPago, parsePlazosCobranza } from '@/lib/cobranzas/plazos'
import { resolverPlantillaIdEmision } from '@/lib/plantillas/resolver-plantilla'
import { resolverCotizacionUsdDocumento, CotizacionUsdFaltanteError } from '@/lib/moneda'
import { siguienteNumeroPresupuesto, crearConNumeroUnico } from '@/lib/sequences'
import { plain } from '@/lib/serialize'
import { registrarAuditoria, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('presupuestos.read')
    const { searchParams } = new URL(req.url)
    const facturables = searchParams.get('facturables') === '1'
    const clienteId = searchParams.get('clienteId')

    const presupuestos = await prisma.presupuesto.findMany({
      where: facturables
        ? {
            estado: 'APROBADO',
            factura: null,
            ...(clienteId ? { clienteId } : {}),
          }
        : undefined,
      orderBy: { creadoEn: 'desc' },
      include: { cliente: { select: { nombre: true } } },
    })
    return NextResponse.json(plain(presupuestos))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('presupuestos.create')
    const body = await req.json()
    const data = presupuestoCreateSchema.parse(body)

    if (data.otId) {
      const ot = await prisma.ordenTrabajo.findUnique({ where: { id: data.otId } })
      if (!ot) throw new ApiError(404, 'Orden de trabajo no encontrada')
      if (ot.clienteId !== data.clienteId) {
        throw new ApiError(400, 'El cliente debe coincidir con el de la OT')
      }
    }

    let emisorId = data.emisorId ?? null
    if (!emisorId) {
      const def = await prisma.emisor.findFirst({ where: { predeterminado: true, activo: true } })
      emisorId = def?.id ?? null
    }

    const moneda = data.moneda ?? 'ARS'

    const itemsConPrecio = await aplicarPreciosResueltosItems(data.items, {
      clienteId: data.clienteId,
      moneda,
    })

    const {
      itemsCalculados,
      subtotal,
      iva,
      interesFinanciacion,
      total,
      alicuotaIvaPct,
      plazos,
    } = calcularTotalesPresupuesto({
      items: itemsConPrecio,
      bonificacionPct: data.bonificacionPct,
      alicuotaIvaPct: data.alicuotaIvaPct,
      plazosCobranza: data.plazosCobranza,
      condicionPago: data.condicionPago,
      tasaFinanciacionPct: data.tasaFinanciacionPct,
      interesFinanciacion: data.interesFinanciacion,
    })

    const condicionPago =
      data.condicionPago?.trim() ||
      (plazos.length > 0 ? formatCondicionPago(plazos) : null)
    const tasaFinanciacionPct = data.tasaFinanciacionPct ?? 0

    let cotizacionUsd: number | null = null
    try {
      cotizacionUsd = await resolverCotizacionUsdDocumento(prisma, moneda, data.cotizacionUsd)
    } catch (e) {
      if (e instanceof CotizacionUsdFaltanteError) throw new ApiError(400, e.message)
      throw e
    }

    const vence = new Date()
    vence.setDate(vence.getDate() + (data.vigenciaDias ?? 15))

    const plantillaId = await resolverPlantillaIdEmision('PRESUPUESTO', data.plantillaId ?? null)

    const presupuesto = await crearConNumeroUnico(
      siguienteNumeroPresupuesto,
      (numero) =>
        prisma.presupuesto.create({
          data: {
            numero,
            clienteId: data.clienteId,
            otId: data.otId ?? null,
            emisorId,
            plantillaId,
            vendedorId: actor.id,
            condicionPago,
            tasaFinanciacionPct,
            interesFinanciacion,
            vigenciaDias: data.vigenciaDias ?? 15,
            observaciones: data.observaciones ?? null,
            formaPago: data.formaPago ?? null,
            plazoEntrega: data.plazoEntrega ?? null,
            garantia: data.garantia ?? null,
            bonificacionPct: data.bonificacionPct ?? 0,
            alicuotaIvaPct,
            moneda,
            cotizacionUsd,
            subtotal,
            iva,
            total,
            fechaVencimiento: vence,
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
          include: { cliente: true, items: true, emisor: true, ot: { select: { id: true, numero: true } } },
        }),
    )

    await registrarAuditoria({
      usuarioId: actor.id,
      accion: 'presupuesto.create',
      entidad: 'Presupuesto',
      entidadId: presupuesto.id,
      ip: getIp(req),
    })

    return NextResponse.json(plain(presupuesto), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
