/**
 * lib/proveedores-metrics.ts
 * KPIs de desempeño del proveedor derivados de la información cargada.
 *
 * Limitación documentada (decisión de experto):
 * - El volumen comprado, el cumplimiento de plazos de entrega y la cuenta
 *   corriente a pagar dependen del módulo de COMPRAS / Órdenes de Compra
 *   (Fase 6), que todavía no existe. Por eso esos KPIs quedan como `null`/0 y se
 *   marcan como "pendiente Fase 6" en la UI.
 * - Lo que SÍ podemos calcular hoy: cantidad de productos provistos, costo
 *   promedio, variación de precios por producto (a partir del histórico de
 *   vigencias) y el costo financiero real por condición comercial.
 */

export interface ProductoProveedorInput {
  inventarioId?: string | null
  nombreProducto: string
  costo: number
  moneda: string
  leadTimeDias?: number | null
  vigenteDesde: Date | string
}

export interface CondicionProveedorInput {
  descripcion: string
  plazoDias: number
  recargoPct: number
  descuentoPct: number
}

export interface VariacionPrecio {
  producto: string
  costoInicial: number
  costoActual: number
  variacionPct: number
  registros: number
}

export interface MetricasProveedor {
  cantidadProductos: number // productos distintos provistos
  registrosPrecio: number // filas de lista de precios (incluye histórico)
  costoPromedio: number
  leadTimePromedioDias: number | null
  cantidadContactos: number
  cantidadCondiciones: number
  mejorFinanciacion: { descripcion: string; plazoDias: number; recargoPct: number } | null
  variacionesPrecio: VariacionPrecio[]
  // Pendiente Fase 6 (Compras): no calculables aún.
  volumenComprado: number | null
  cumplimientoPlazos: number | null
  saldoAPagar: number | null
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v)
}

/** Clave para agrupar precios del mismo producto (por inventarioId o nombre). */
function claveProducto(p: ProductoProveedorInput): string {
  return p.inventarioId ?? p.nombreProducto.trim().toLowerCase()
}

export function calcularMetricasProveedor(
  productos: ProductoProveedorInput[],
  condiciones: CondicionProveedorInput[],
  cantidadContactos: number,
): MetricasProveedor {
  const grupos = new Map<string, ProductoProveedorInput[]>()
  for (const p of productos) {
    const k = claveProducto(p)
    const arr = grupos.get(k) ?? []
    arr.push(p)
    grupos.set(k, arr)
  }

  const costoPromedio =
    productos.length > 0 ? productos.reduce((a, p) => a + p.costo, 0) / productos.length : 0

  const leads = productos.map((p) => p.leadTimeDias).filter((v): v is number => typeof v === 'number')
  const leadTimePromedioDias =
    leads.length > 0 ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : null

  const variacionesPrecio: VariacionPrecio[] = []
  for (const [, lista] of grupos) {
    if (lista.length < 2) continue
    const ordenada = [...lista].sort(
      (a, b) => toDate(a.vigenteDesde).getTime() - toDate(b.vigenteDesde).getTime(),
    )
    const costoInicial = ordenada[0].costo
    const costoActual = ordenada[ordenada.length - 1].costo
    const variacionPct = costoInicial > 0 ? ((costoActual - costoInicial) / costoInicial) * 100 : 0
    variacionesPrecio.push({
      producto: ordenada[0].nombreProducto,
      costoInicial,
      costoActual,
      variacionPct: Math.round(variacionPct * 10) / 10,
      registros: ordenada.length,
    })
  }

  // Mejor financiación = mayor plazo con menor recargo neto
  let mejorFinanciacion: MetricasProveedor['mejorFinanciacion'] = null
  if (condiciones.length > 0) {
    const sorted = [...condiciones].sort((a, b) => {
      const ra = a.recargoPct - a.descuentoPct
      const rb = b.recargoPct - b.descuentoPct
      if (ra !== rb) return ra - rb
      return b.plazoDias - a.plazoDias
    })
    const c = sorted[0]
    mejorFinanciacion = { descripcion: c.descripcion, plazoDias: c.plazoDias, recargoPct: c.recargoPct }
  }

  return {
    cantidadProductos: grupos.size,
    registrosPrecio: productos.length,
    costoPromedio,
    leadTimePromedioDias,
    cantidadContactos,
    cantidadCondiciones: condiciones.length,
    mejorFinanciacion,
    variacionesPrecio,
    volumenComprado: null,
    cumplimientoPlazos: null,
    saldoAPagar: null,
  }
}

/**
 * Costo financiero real de un producto bajo una condición comercial:
 * aplica el descuento y luego el recargo por plazo.
 * Útil para el futuro comparador de compras (Fase 6).
 */
export function costoFinancieroReal(costo: number, condicion: CondicionProveedorInput): number {
  const conDescuento = costo * (1 - condicion.descuentoPct / 100)
  return conDescuento * (1 + condicion.recargoPct / 100)
}
