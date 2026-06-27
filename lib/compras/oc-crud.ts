import { prisma } from '@/lib/prisma'
import type { ordenCompraCreateSchema } from '@/lib/validation'
import type { z } from 'zod'

type OrdenCompraInput = z.infer<typeof ordenCompraCreateSchema>

export async function resolverCotizacionUsd(
  moneda: string | undefined,
  cotizacionUsdInput?: number | null,
): Promise<number | null> {
  if (moneda && moneda !== 'USD') return null
  if (cotizacionUsdInput != null && cotizacionUsdInput > 0) return cotizacionUsdInput
  const config = await prisma.configuracionContable.findUnique({
    where: { id: 'default' },
    select: { cotizacionUsdManual: true },
  })
  return config?.cotizacionUsdManual ?? null
}

export function mapOcHeaderFields(data: OrdenCompraInput) {
  return {
    proveedorId: data.proveedorId,
    observaciones: data.observaciones ?? null,
    solicitanteId: data.solicitanteId ?? null,
    justificacion: data.justificacion ?? null,
    clasificacionOrigen: data.clasificacionOrigen ?? null,
    ordenTrabajoId: data.ordenTrabajoId ?? null,
    presupuestoId: data.presupuestoId ?? null,
    clienteId: data.clienteId ?? null,
    depositoDestinoDefaultId: data.depositoDestinoDefaultId ?? null,
    moneda: data.moneda ?? 'ARS',
    plantillaOcId: data.plantillaOcId ?? null,
  }
}

export function mapOcItemsCreate(
  data: OrdenCompraInput,
  itemsCalc: ReturnType<typeof import('@/lib/compras/oc').calcularTotalesOC>['itemsCalc'],
) {
  return itemsCalc.map((i, idx) => ({
    inventarioId: data.items[idx].inventarioId ?? null,
    concepto: data.items[idx].concepto ?? null,
    descripcion: data.items[idx].descripcion,
    cantidad: i.cantidad,
    precioUnit: i.precioUnit,
    precioLista: data.items[idx].precioLista ?? null,
    bonificacionPct: data.items[idx].bonificacionPct ?? 0,
    subtotal: i.subtotal,
    depositoDestinoId: data.items[idx].depositoDestinoId ?? null,
  }))
}
