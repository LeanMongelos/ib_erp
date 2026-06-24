/**
 * Re-resuelve precios de ítems con inventarioId al persistir documentos (API = fuente de verdad).
 */
import type { ItemDocumentoInput } from '@/lib/documentos'
import { resolverPrecio } from '@/lib/precios/resolver-precio'

export async function aplicarPreciosResueltosItems(
  items: ItemDocumentoInput[],
  opts: { clienteId: string; moneda: string },
): Promise<ItemDocumentoInput[]> {
  const out: ItemDocumentoInput[] = []
  for (const item of items) {
    if (!item.inventarioId) {
      out.push(item)
      continue
    }
    const res = await resolverPrecio({
      inventarioId: item.inventarioId,
      clienteId: opts.clienteId,
      moneda: opts.moneda,
    })
    out.push({ ...item, precioUnit: res.precioUnit })
  }
  return out
}
