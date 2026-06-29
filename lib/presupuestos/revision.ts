/**
 * Revisiones y copias de presupuesto (mismo u otro cliente).
 */
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api-auth'
import { calcularTotalesPresupuesto } from '@/lib/presupuestos/calcular-total-presupuesto'

function numeroBasePresupuesto(numero: string): string {
  return numero.replace(/-Rev\d+$/i, '')
}

function numeroRevision(base: string, version: number): string {
  return version <= 1 ? base : `${base}-Rev${version}`
}

export function idRaizPresupuesto(p: { id: string; presupuestoRaizId?: string | null }): string {
  return p.presupuestoRaizId ?? p.id
}

export async function listarVersionesPresupuesto(presupuestoId: string) {
  const p = await prisma.presupuesto.findUnique({
    where: { id: presupuestoId },
    select: { id: true, presupuestoRaizId: true },
  })
  if (!p) return []

  const raizId = idRaizPresupuesto(p)
  return prisma.presupuesto.findMany({
    where: {
      OR: [{ id: raizId }, { presupuestoRaizId: raizId }],
    },
    orderBy: [{ version: 'asc' }, { creadoEn: 'asc' }],
    select: {
      id: true,
      numero: true,
      version: true,
      estado: true,
      total: true,
      moneda: true,
      clienteId: true,
      cliente: { select: { nombre: true } },
      creadoEn: true,
      presupuestoOrigenId: true,
    },
  })
}

export async function crearRevisionPresupuesto(params: {
  origenId: string
  clienteId?: string
  usuarioId: string
  motivo?: string
}) {
  const origen = await prisma.presupuesto.findUnique({
    where: { id: params.origenId },
    include: { items: true, factura: { select: { id: true } }, ordenVenta: { select: { id: true } } },
  })
  if (!origen) throw new ApiError(404, 'Presupuesto no encontrado')

  const copiaOtroCliente = Boolean(params.clienteId && params.clienteId !== origen.clienteId)
  const clienteId = params.clienteId ?? origen.clienteId

  if (copiaOtroCliente) {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, activo: true } })
    if (!cliente?.activo) throw new ApiError(400, 'Cliente destino no válido')
  }

  if (!origen.factura && origen.ordenVenta && !copiaOtroCliente) {
    throw new ApiError(
      400,
      'Este presupuesto ya tiene orden de venta o remito. Anulá o completá ese flujo antes de crear una revisión.',
    )
  }

  const raizId = idRaizPresupuesto(origen)
  const raiz = await prisma.presupuesto.findUnique({
    where: { id: raizId },
    select: { id: true, numero: true, version: true },
  })
  if (!raiz) throw new ApiError(404, 'Presupuesto raíz no encontrado')

  const maxEnCadena = await prisma.presupuesto.aggregate({
    where: { OR: [{ id: raizId }, { presupuestoRaizId: raizId }] },
    _max: { version: true },
  })
  const nuevaVersion = (maxEnCadena._max.version ?? raiz.version ?? 1) + 1
  const baseNumero = numeroBasePresupuesto(raiz.numero)
  const numero = numeroRevision(baseNumero, nuevaVersion)

  const existenteNumero = await prisma.presupuesto.findUnique({ where: { numero } })
  if (existenteNumero) {
    throw new ApiError(409, `Ya existe el presupuesto ${numero}`)
  }

  const ahora = new Date()
  const vence = new Date(ahora)
  vence.setDate(vence.getDate() + origen.vigenciaDias)

  const notaRevision = params.motivo?.trim()
    ? `\n[Revisión v${nuevaVersion}] ${params.motivo.trim()}`
    : `\n[Revisión v${nuevaVersion} desde ${origen.numero}]`

  const observaciones = `${origen.observaciones ?? ''}${notaRevision}`.trim()

  const otId = copiaOtroCliente ? null : origen.otId

  return prisma.$transaction(async (tx) => {
    if (
      !origen.factura &&
      !copiaOtroCliente &&
      ['BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'VENCIDO'].includes(origen.estado)
    ) {
      await tx.presupuesto.update({
        where: { id: origen.id },
        data: {
          estado: 'VENCIDO',
          observaciones: `${origen.observaciones ?? ''}\n[Reemplazado por ${numero}]`.trim(),
        },
      })
    }

    const creado = await tx.presupuesto.create({
      data: {
        numero,
        version: nuevaVersion,
        presupuestoRaizId: raizId,
        presupuestoOrigenId: origen.id,
        estado: 'BORRADOR',
        clienteId,
        otId,
        emisorId: origen.emisorId,
        plantillaId: origen.plantillaId,
        vendedorId: params.usuarioId,
        condicionPago: origen.condicionPago,
        tasaFinanciacionPct: origen.tasaFinanciacionPct,
        interesFinanciacion: origen.interesFinanciacion,
        vigenciaDias: origen.vigenciaDias,
        observaciones,
        formaPago: origen.formaPago,
        plazoEntrega: origen.plazoEntrega,
        garantia: origen.garantia,
        subtotal: origen.subtotal,
        iva: origen.iva,
        total: origen.total,
        moneda: origen.moneda,
        cotizacionUsd: origen.cotizacionUsd,
        bonificacionPct: origen.bonificacionPct,
        alicuotaIvaPct: origen.alicuotaIvaPct,
        fechaEmision: ahora,
        fechaVencimiento: vence,
        items: {
          create: origen.items.map((item) => ({
            codigo: item.codigo,
            descripcion: item.descripcion,
            descripcionLarga: item.descripcionLarga,
            fotoUrl: item.fotoUrl,
            cantidad: item.cantidad,
            precioUnit: item.precioUnit,
            bonificacionPct: item.bonificacionPct,
            alicuotaIvaPct: item.alicuotaIvaPct,
            subtotal: item.subtotal,
            inventarioId: item.inventarioId,
            numeroSerie: item.numeroSerie,
            proximoPreventivo: item.proximoPreventivo,
          })),
        },
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        items: true,
        presupuestoOrigen: { select: { id: true, numero: true } },
      },
    })

    return creado
  })
}

/** Recalcula totales al editar ítems/condiciones (PATCH). */
export function recalcularPresupuestoDesdeItems(params: {
  items: Array<{
    descripcion: string
    cantidad: number
    precioUnit: number
    bonificacionPct?: number
    alicuotaIvaPct?: number | null
    codigo?: string | null
    descripcionLarga?: string | null
    fotoUrl?: string | null
    inventarioId?: string | null
    numeroSerie?: string | null
    proximoPreventivo?: Date | string | null
  }>
  bonificacionPct?: number
  alicuotaIvaPct?: number
  condicionPago?: string | null
  plazosCobranza?: number[]
  tasaFinanciacionPct?: number
  interesFinanciacion?: number
}) {
  return calcularTotalesPresupuesto({
    items: params.items,
    bonificacionPct: params.bonificacionPct,
    alicuotaIvaPct: params.alicuotaIvaPct,
    condicionPago: params.condicionPago ?? undefined,
    plazosCobranza: params.plazosCobranza,
    tasaFinanciacionPct: params.tasaFinanciacionPct,
    interesFinanciacion: params.interesFinanciacion,
  })
}

export function presupuestoEditable(estado: string, tieneFactura: boolean): boolean {
  if (tieneFactura) return false
  return ['BORRADOR', 'ENVIADO'].includes(estado)
}

export function presupuestoPuedeRevisar(estado: string, tieneFactura: boolean): boolean {
  if (tieneFactura) return true
  return ['BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'CONVERTIDO'].includes(estado)
}
