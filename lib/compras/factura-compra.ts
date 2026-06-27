import type {
  EstadoFacturaCompra,
  EstadoOrdenCompra,
  ItemOrdenCompra,
  TipoFacturaCompra,
} from '@prisma/client'
import { calcularPrecioNetoItem } from '@/lib/compras/bonificacion'
import { validarMonedaFcVsOc } from '@/lib/compras/moneda-compra'
import { redondear2 } from '@/lib/utils'

export interface LineaFacturaCompraInput {
  descripcion: string
  concepto?: string | null
  cantidad: number
  precioUnitario: number
  precioLista?: number | null
  bonificacionPct?: number
  alicuotaIvaPct?: number
  inventarioId?: string | null
  itemOrdenCompraId?: string | null
}

export interface LineaFacturaCompraCalc extends LineaFacturaCompraInput {
  neto: number
  iva: number
}

export interface TotalesFacturaCompra {
  neto: number
  iva: number
  total: number
  itemsCalc: LineaFacturaCompraCalc[]
}

export function calcularTotalesFacturaCompra(
  items: LineaFacturaCompraInput[],
): TotalesFacturaCompra {
  const itemsCalc: LineaFacturaCompraCalc[] = items.map((item) => {
    const alicuota = item.alicuotaIvaPct ?? 21
    const precioUnitario = calcularPrecioNetoItem({
      precioUnit: item.precioUnitario,
      precioLista: item.precioLista,
      bonificacionPct: item.bonificacionPct,
    })
    const neto = redondear2(item.cantidad * precioUnitario)
    const iva = redondear2(neto * alicuota / 100)
    return { ...item, precioUnitario, alicuotaIvaPct: alicuota, neto, iva }
  })
  const neto = redondear2(itemsCalc.reduce((a, i) => a + i.neto, 0))
  const iva = redondear2(itemsCalc.reduce((a, i) => a + i.iva, 0))
  return { neto, iva, total: redondear2(neto + iva), itemsCalc }
}

/** OC aprobada o en flujo post-aprobación (recepción / enviada legado). */
export const ESTADOS_OC_APROBADAS: EstadoOrdenCompra[] = [
  'APROBADA',
  'ENVIADA',
  'PARCIAL',
  'RECIBIDA',
]

export function ocEstaAprobada(estado: EstadoOrdenCompra): boolean {
  return ESTADOS_OC_APROBADAS.includes(estado)
}

export function ocRecepcionCompleta(items: Pick<ItemOrdenCompra, 'cantidad' | 'cantidadRecibida'>[]): boolean {
  if (items.length === 0) return false
  return items.every((i) => i.cantidadRecibida >= i.cantidad)
}

export function ocTieneRecepcion(items: Pick<ItemOrdenCompra, 'cantidadRecibida'>[]): boolean {
  return items.some((i) => i.cantidadRecibida > 0)
}

export interface ValidarFacturaCompraContext {
  tipo: TipoFacturaCompra
  ordenCompraId?: string | null
  fcSinRecepcion?: boolean
  notaFcSinRecepcion?: string | null
  moneda?: string
  notaMonedaOc?: string | null
  oc?: {
    id: string
    proveedorId: string
    estado: EstadoOrdenCompra
    moneda?: string
    items: Pick<ItemOrdenCompra, 'id' | 'cantidad' | 'cantidadRecibida' | 'inventarioId'>[]
  } | null
}

export function validarReglasFacturaCompra(ctx: ValidarFacturaCompraContext): string | null {
  if (!ctx.ordenCompraId || !ctx.oc) {
    return 'Toda factura de compra requiere una orden de compra aprobada'
  }
  if (!ocEstaAprobada(ctx.oc.estado)) {
    return 'La orden de compra debe estar aprobada para registrar la factura'
  }

  const errorMoneda = validarMonedaFcVsOc(ctx.moneda ?? 'ARS', ctx.oc.moneda, ctx.notaMonedaOc)
  if (errorMoneda) return errorMoneda

  if (ctx.tipo === 'REMITO') {
    const recepcionOk = ocTieneRecepcion(ctx.oc.items) || ocRecepcionCompleta(ctx.oc.items)
    if (!recepcionOk && !ctx.fcSinRecepcion) {
      return 'Recepción pendiente: indique recepción en la OC o marque factura sin recepción previa'
    }
    if (ctx.fcSinRecepcion && !ctx.notaFcSinRecepcion?.trim()) {
      return 'Indicá una nota al registrar factura remito sin recepción previa'
    }
  }

  return null
}

export function derivarRecepcionCompleta(
  ocItems: Pick<ItemOrdenCompra, 'cantidad' | 'cantidadRecibida'>[] | undefined,
): boolean {
  if (!ocItems?.length) return false
  return ocRecepcionCompleta(ocItems)
}

export function puedeEditarFacturaCompra(estado: EstadoFacturaCompra): boolean {
  return estado === 'BORRADOR'
}

export function puedeRegistrarFacturaCompra(estado: EstadoFacturaCompra): boolean {
  return estado === 'BORRADOR'
}

export function puedeAnularFacturaCompra(estado: EstadoFacturaCompra): boolean {
  return estado === 'REGISTRADA'
}

export function calcularFechaVencimientoDefault(fecha: Date, fechaVencimiento?: Date | null): Date {
  if (fechaVencimiento) return fechaVencimiento
  const d = new Date(fecha)
  d.setDate(d.getDate() + 30)
  return d
}

export function saldoPendienteFactura(
  vencimientos: { saldo: number; pagado: boolean }[],
): number {
  return redondear2(
    vencimientos.filter((v) => !v.pagado).reduce((a, v) => a + v.saldo, 0),
  )
}

export function prefillsDesdeOC(
  oc: {
    proveedorId: string
    items: Array<{
      id: string
      descripcion: string
      concepto: string | null
      cantidad: number
      cantidadRecibida: number
      precioUnit: number
      precioLista?: number | null
      bonificacionPct?: number
      inventarioId: string | null
    }>
  },
  tipo: TipoFacturaCompra,
): LineaFacturaCompraInput[] {
  const mapItem = (it: (typeof oc.items)[number], cantidad: number): LineaFacturaCompraInput => ({
    descripcion: it.descripcion,
    concepto: it.concepto,
    cantidad,
    precioUnitario: it.precioUnit,
    precioLista: it.precioLista ?? null,
    bonificacionPct: it.bonificacionPct ?? 0,
    inventarioId: tipo === 'REMITO' ? it.inventarioId : null,
    itemOrdenCompraId: it.id,
  })

  if (tipo === 'CONCEPTOS') {
    return oc.items.map((it) => mapItem(it, it.cantidad))
  }
  return oc.items
    .filter((it) => it.cantidadRecibida > 0 || it.inventarioId)
    .map((it) =>
      mapItem(it, it.cantidadRecibida > 0 ? it.cantidadRecibida : it.cantidad),
    )
}

export function inferirTipoFacturaDesdeOC(
  items: Pick<ItemOrdenCompra, 'inventarioId' | 'concepto'>[],
): TipoFacturaCompra {
  const tieneStock = items.some((i) => i.inventarioId)
  return tieneStock ? 'REMITO' : 'CONCEPTOS'
}
