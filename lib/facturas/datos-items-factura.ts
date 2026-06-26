/**
 * Mapeo ítems calculados → persistencia FacturaItem (POST y PATCH).
 */
import type { ItemDocumentoCalculado } from '@/lib/documentos'

type ItemFacturaExtra = {
  numeroSerie?: string | null
  proximoPreventivo?: Date | string | null
  sucursalInstalacionId?: string | null
  inventarioUnidadId?: string | null
}

export function datosItemsFacturaCreate(
  facturaId: string,
  items: ItemDocumentoCalculado[],
  extras?: ItemFacturaExtra[],
) {
  return items.map((i, idx) => {
    const ext = extras?.[idx]
    const numeroSerie = (ext?.numeroSerie ?? i.numeroSerie?.trim()) || null
    const proxRaw = ext?.proximoPreventivo ?? i.proximoPreventivo
    return {
      facturaId,
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
      numeroSerie,
      proximoPreventivo: proxRaw ? new Date(proxRaw as string | Date) : null,
      sucursalInstalacionId: ext?.sucursalInstalacionId ?? i.sucursalInstalacionId ?? null,
      inventarioUnidadId: ext?.inventarioUnidadId ?? i.inventarioUnidadId ?? null,
    }
  })
}

/** Para `items: { create: [...] }` en prisma.presupuesto/factura.create */
export function datosItemsFacturaNestedCreate(
  items: ItemDocumentoCalculado[],
  extras?: ItemFacturaExtra[],
) {
  return datosItemsFacturaCreate('', items, extras).map(({ facturaId: _f, ...rest }) => rest)
}
