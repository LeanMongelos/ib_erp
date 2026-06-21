/**
 * lib/documentos.ts
 * Cálculo compartido de ítems y totales para presupuestos y facturas.
 */

import { redondear2 } from '@/lib/utils'

/** @deprecated Usar alicuota configurable por documento/ítem */
export const IVA_TASA = 0.21

export interface ItemDocumentoInput {
  descripcion: string
  codigo?: string | null
  descripcionLarga?: string | null
  fotoUrl?: string | null
  cantidad: number
  precioUnit: number
  bonificacionPct?: number
  inventarioId?: string | null
  alicuotaIvaPct?: number | null
  numeroSerie?: string | null
  proximoPreventivo?: Date | string | null
  sucursalInstalacionId?: string | null
}

export interface ItemDocumentoCalculado extends ItemDocumentoInput {
  subtotal: number
  alicuotaIvaPct: number
  ivaItem: number
}

export function calcularItem(
  item: ItemDocumentoInput,
  alicuotaDocumentoPct = 21,
): ItemDocumentoCalculado {
  const bonif = item.bonificacionPct ?? 0
  const bruto = item.cantidad * item.precioUnit
  const subtotal = redondear2(bruto * (1 - bonif / 100))
  const alicuotaIvaPct = item.alicuotaIvaPct ?? alicuotaDocumentoPct
  const ivaItem = redondear2(subtotal * (alicuotaIvaPct / 100))
  return { ...item, subtotal, alicuotaIvaPct, ivaItem }
}

export function calcularTotales(
  items: ItemDocumentoInput[],
  bonificacionGlobalPct = 0,
  alicuotaDocumentoPct = 21,
) {
  const itemsCalculados = items.map((i) => calcularItem(i, alicuotaDocumentoPct))
  const subtotalBruto = redondear2(itemsCalculados.reduce((a, i) => a + i.subtotal, 0))
  const subtotal = redondear2(subtotalBruto * (1 - bonificacionGlobalPct / 100))
  const factorBonif = subtotalBruto > 0 ? subtotal / subtotalBruto : 1
  const iva = redondear2(
    itemsCalculados.reduce((a, i) => a + redondear2(i.ivaItem * factorBonif), 0),
  )
  const total = redondear2(subtotal + iva)
  return { itemsCalculados, subtotal, iva, total, alicuotaIvaPct: alicuotaDocumentoPct }
}

export function resumenIvaPorAlicuota(items: ItemDocumentoCalculado[]) {
  const map = new Map<number, { base: number; iva: number }>()
  for (const i of items) {
    const prev = map.get(i.alicuotaIvaPct) ?? { base: 0, iva: 0 }
    map.set(i.alicuotaIvaPct, {
      base: redondear2(prev.base + i.subtotal),
      iva: redondear2(prev.iva + i.ivaItem),
    })
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([porcentaje, v]) => ({ porcentaje, ...v }))
}
