import { prisma } from '@/lib/prisma'
import { redondear2 } from '@/lib/utils'
import { hrefOc } from '@/lib/compras/oc-workflow/constants'
import {
  labelEventoOc,
  type PasoOcEstado,
  type PasoOcTimeline,
  type EventoOcTimeline,
  type TimelineOcResult,
} from '@/lib/compras/oc-workflow/timeline-types'

export type { PasoOcEstado, PasoOcTimeline, EventoOcTimeline, TimelineOcResult }
export { labelEventoOc }

function pctRecepcion(items: Array<{ cantidad: number; cantidadRecibida: number; inventarioId: string | null }>): number | null {
  const stock = items.filter((i) => i.inventarioId)
  if (stock.length === 0) return null
  const pedido = stock.reduce((a, i) => a + i.cantidad, 0)
  if (pedido === 0) return null
  const recibido = stock.reduce((a, i) => a + i.cantidadRecibida, 0)
  return Math.min(100, Math.round((recibido / pedido) * 100))
}

function pctFacturacion(
  totalOc: number,
  facturas: Array<{ total: number; estado: string }>,
): number {
  if (totalOc <= 0) return facturas.some((f) => f.estado === 'REGISTRADA') ? 100 : 0
  const fcTotal = facturas
    .filter((f) => f.estado === 'REGISTRADA')
    .reduce((a, f) => a + f.total, 0)
  return Math.min(100, Math.round((fcTotal / totalOc) * 100))
}

function pctPago(vencimientos: Array<{ saldo: number; monto: number }>): number {
  if (vencimientos.length === 0) return 0
  const total = vencimientos.reduce((a, v) => a + v.monto, 0)
  const saldo = vencimientos.reduce((a, v) => a + v.saldo, 0)
  if (total <= 0) return 0
  return Math.min(100, Math.round(((total - saldo) / total) * 100))
}

function construirPasos(input: {
  estado: string
  tieneStock: boolean
  pctRec: number | null
  pctFc: number
  pctPag: number
  rechazadoMotivo?: string | null
}): PasoOcTimeline[] {
  const pasos: PasoOcTimeline[] = []

  const solicitudCompleta = !['BORRADOR'].includes(input.estado)
  pasos.push({
    id: 'solicitud',
    label: 'Solicitud',
    estado: solicitudCompleta ? 'completo' : input.estado === 'BORRADOR' ? 'activo' : 'pendiente',
  })

  let aprobacion: PasoOcEstado = 'pendiente'
  if (input.estado === 'PENDIENTE_APROBACION') aprobacion = 'activo'
  else if (input.estado === 'RECHAZADA') aprobacion = 'rechazado'
  else if (['APROBADA', 'ENVIADA', 'PARCIAL', 'RECIBIDA', 'CANCELADA'].includes(input.estado)) {
    aprobacion = 'completo'
  }
  pasos.push({
    id: 'aprobacion',
    label: 'Aprobación',
    estado: aprobacion,
    detalle: input.estado === 'RECHAZADA' ? input.rechazadoMotivo ?? undefined : undefined,
  })

  if (input.tieneStock) {
    let rec: PasoOcEstado = 'pendiente'
    if (input.pctRec != null) {
      if (input.pctRec >= 100) rec = 'completo'
      else if (input.pctRec > 0) rec = 'activo'
      else if (['APROBADA', 'ENVIADA', 'PARCIAL'].includes(input.estado)) rec = 'activo'
    }
    pasos.push({
      id: 'recepcion',
      label: 'Recepción mercadería',
      estado: rec,
      detalle: input.pctRec != null ? `${input.pctRec}% recibido` : undefined,
    })
  } else {
    pasos.push({ id: 'recepcion', label: 'Recepción', estado: 'omitido', detalle: 'No aplica (sin stock)' })
  }

  let fcEstado: PasoOcEstado = 'pendiente'
  if (input.pctFc >= 100) fcEstado = 'completo'
  else if (input.pctFc > 0) fcEstado = 'activo'
  else if (['APROBADA', 'PARCIAL', 'RECIBIDA'].includes(input.estado)) fcEstado = 'activo'
  pasos.push({
    id: 'facturacion',
    label: 'Factura proveedor',
    estado: fcEstado,
    detalle: `${input.pctFc}% facturado`,
  })

  let pagoEstado: PasoOcEstado = 'pendiente'
  if (input.pctPag >= 100) pagoEstado = 'completo'
  else if (input.pctPag > 0) pagoEstado = 'activo'
  pasos.push({
    id: 'pago',
    label: 'Pago / deuda',
    estado: pagoEstado,
    detalle: `${input.pctPag}% pagado`,
  })

  const cerrada =
    input.estado === 'RECIBIDA' && input.pctFc >= 100 && input.pctPag >= 100
      || (!input.tieneStock && input.pctFc >= 100 && input.pctPag >= 100)
  pasos.push({
    id: 'cierre',
    label: 'Cierre',
    estado: cerrada ? 'completo' : 'pendiente',
  })

  return pasos
}

export async function construirTimelineOc(ordenCompraId: string): Promise<TimelineOcResult | null> {
  const oc = await prisma.ordenCompra.findUnique({
    where: { id: ordenCompraId },
    include: {
      items: { select: { cantidad: true, cantidadRecibida: true, inventarioId: true } },
      facturasCompra: {
        select: {
          id: true,
          numero: true,
          total: true,
          estado: true,
          vencimientos: { select: { monto: true, saldo: true } },
        },
      },
      eventos: {
        orderBy: { fecha: 'asc' },
        include: { usuario: { select: { id: true, nombre: true } } },
      },
    },
  })
  if (!oc) return null

  const tieneStock = oc.items.some((i) => i.inventarioId)
  const pctRec = pctRecepcion(oc.items)
  const pctFc = pctFacturacion(oc.total, oc.facturasCompra)
  const vencs = oc.facturasCompra.flatMap((f) => f.vencimientos)
  const pctPag = pctPago(vencs)

  const partes: number[] = []
  if (pctRec != null) partes.push(pctRec)
  partes.push(pctFc, pctPag)
  const cumplimientoPct = partes.length
    ? Math.round(partes.reduce((a, b) => a + b, 0) / partes.length)
    : 0

  const pasos = construirPasos({
    estado: oc.estado,
    tieneStock,
    pctRec,
    pctFc,
    pctPag,
    rechazadoMotivo: oc.rechazadoMotivo,
  })

  const eventos: EventoOcTimeline[] = oc.eventos.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    fecha: e.fecha.toISOString(),
    referencia: e.referencia,
    usuario: e.usuario,
    payload: e.payload ?? undefined,
    href: hrefOc(oc.id),
  }))

  return {
    ordenCompraId: oc.id,
    numero: oc.numero,
    estado: oc.estado,
    cumplimientoPct: redondear2(cumplimientoPct),
    pasos,
    eventos,
  }
}
