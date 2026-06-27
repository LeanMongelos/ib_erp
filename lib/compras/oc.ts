import type { EstadoOrdenCompra, TipoCompraProveedor } from '@prisma/client'
import { calcularPrecioNetoItem } from '@/lib/compras/bonificacion'

export { calcularPrecioNetoItem, calcularPrecioNeto } from '@/lib/compras/bonificacion'

export function calcularTotalesOC(
  items: { cantidad: number; precioUnit: number; precioLista?: number | null; bonificacionPct?: number }[],
) {
  const itemsCalc = items.map((i) => {
    const precioUnit = calcularPrecioNetoItem(i)
    return {
      ...i,
      precioUnit,
      subtotal: Math.round(i.cantidad * precioUnit * 100) / 100,
    }
  })
  const subtotal = itemsCalc.reduce((a, i) => a + i.subtotal, 0)
  return { itemsCalc, subtotal, total: subtotal }
}

/** Estados desde los cuales se puede recepcionar mercadería (remito/stock). */
export const ESTADOS_OC_RECEPCIONABLES: EstadoOrdenCompra[] = [
  'APROBADA',
  'ENVIADA',
  'PARCIAL',
]

export function ocEsRecepcionable(estado: EstadoOrdenCompra): boolean {
  return ESTADOS_OC_RECEPCIONABLES.includes(estado)
}

export function ocEsEditable(estado: EstadoOrdenCompra): boolean {
  return estado === 'BORRADOR' || estado === 'RECHAZADA'
}

export function filtroProveedorPorTipoCompra(tipo: TipoCompraProveedor) {
  if (tipo === 'AMBOS') return {}
  return {
    OR: [{ tipoCompra: tipo }, { tipoCompra: 'AMBOS' as TipoCompraProveedor }],
  }
}
