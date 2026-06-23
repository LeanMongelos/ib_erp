import type { ListaPrecios, ListaPreciosItem, TipoListaPrecios } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { OrigenPrecio, PrecioResuelto } from '@/lib/precios/types'

function vigente(desde: Date | null | undefined, hasta: Date | null | undefined, ahora = new Date()): boolean {
  if (desde && ahora < desde) return false
  if (hasta && ahora > hasta) return false
  return true
}

function listaVigente(lista: ListaPrecios, ahora = new Date()): boolean {
  return lista.activo && vigente(lista.vigenciaDesde, lista.vigenciaHasta, ahora)
}

function itemVigente(item: ListaPreciosItem, ahora = new Date()): boolean {
  return vigente(item.vigenciaDesde, item.vigenciaHasta, ahora)
}

function aplicarDescuentos(precioBase: number, item: ListaPreciosItem, lista: ListaPrecios): number {
  let precio = precioBase
  if (item.bonificacionPct) precio *= 1 - item.bonificacionPct / 100
  if (lista.descuentoGlobalPct) precio *= 1 - lista.descuentoGlobalPct / 100
  return Math.round(precio * 100) / 100
}

async function buscarListaPredeterminada(tipo: TipoListaPrecios, moneda: string): Promise<ListaPrecios | null> {
  return prisma.listaPrecios.findFirst({
    where: { tipo, moneda, activo: true, predeterminada: true },
  })
}

async function cargarListaConItem(listaId: string, inventarioId: string): Promise<{ lista: ListaPrecios; item: ListaPreciosItem } | null> {
  const lista = await prisma.listaPrecios.findUnique({ where: { id: listaId } })
  if (!lista || !listaVigente(lista)) return null

  const item = await prisma.listaPreciosItem.findUnique({
    where: { listaPreciosId_inventarioId: { listaPreciosId: listaId, inventarioId } },
  })
  if (!item || !itemVigente(item)) return null

  return { lista, item }
}

function precioDesdeLista(lista: ListaPrecios, item: ListaPreciosItem): PrecioResuelto {
  return {
    precioUnit: aplicarDescuentos(item.precioUnit, item, lista),
    moneda: lista.moneda,
    origen: 'LISTA' as OrigenPrecio,
    listaPreciosId: lista.id,
    listaPreciosCodigo: lista.codigo,
    listaPreciosNombre: lista.nombre,
    listaPreciosTipo: lista.tipo,
    bonificacionPct: item.bonificacionPct,
    descuentoGlobalPct: lista.descuentoGlobalPct,
  }
}

function precioDesdeInventario(precioUnit: number | null, monedaInventario: string, monedaSolicitada: string): PrecioResuelto | null {
  if (precioUnit == null || monedaInventario !== monedaSolicitada) return null
  return {
    precioUnit,
    moneda: monedaSolicitada,
    origen: 'INVENTARIO',
  }
}

function sinPrecio(moneda: string): PrecioResuelto {
  return { precioUnit: 0, moneda, origen: 'SIN_PRECIO' }
}

export interface ResolverPrecioInput {
  inventarioId: string
  clienteId?: string | null
  moneda?: string
}

/**
 * Prioridad: lista asignada al cliente → esMayorista (MAY predeterminada) →
 * MINOR predeterminada → Inventario.precioUnit (misma moneda) → 0
 */
export async function resolverPrecio({
  inventarioId,
  clienteId,
  moneda = 'ARS',
}: ResolverPrecioInput): Promise<PrecioResuelto> {
  const inventario = await prisma.inventario.findUnique({
    where: { id: inventarioId },
    select: { id: true, precioUnit: true, moneda: true, activo: true },
  })
  if (!inventario || !inventario.activo) {
    throw new Error('Ítem de inventario no encontrado')
  }

  let cliente: {
    listaPreciosId: string | null
    esMayorista: boolean
    monedaPreferida: string | null
  } | null = null

  if (clienteId) {
    cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { listaPreciosId: true, esMayorista: true, monedaPreferida: true },
    })
  }

  const monedaDoc = cliente?.monedaPreferida || moneda

  // 1) Lista explícita del cliente
  if (cliente?.listaPreciosId) {
    const asignada = await cargarListaConItem(cliente.listaPreciosId, inventarioId)
    if (asignada && asignada.lista.moneda === monedaDoc) {
      return precioDesdeLista(asignada.lista, asignada.item)
    }
  }

  // 2) Mayorista → lista MAY predeterminada
  if (cliente?.esMayorista) {
    const listaMay = await buscarListaPredeterminada('MAYORISTA', monedaDoc)
    if (listaMay) {
      const match = await cargarListaConItem(listaMay.id, inventarioId)
      if (match) return precioDesdeLista(match.lista, match.item)
    }
  }

  // 3) Lista MINOR predeterminada
  const listaMin = await buscarListaPredeterminada('MINORISTA', monedaDoc)
  if (listaMin) {
    const match = await cargarListaConItem(listaMin.id, inventarioId)
    if (match) return precioDesdeLista(match.lista, match.item)
  }

  // 4) Precio base inventario (misma moneda)
  const inv = precioDesdeInventario(inventario.precioUnit, inventario.moneda, monedaDoc)
  if (inv) return inv

  // 5) Sin precio
  return sinPrecio(monedaDoc)
}
