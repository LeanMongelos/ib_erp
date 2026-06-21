/**
 * lib/clientes-metrics.ts
 * Cálculo de métricas de comportamiento del cliente (ficha 360°).
 *
 * Toda la inteligencia comercial se DERIVA de las facturas e items existentes;
 * no se persiste ninguna tabla nueva de métricas. Las funciones son puras y
 * tipadas, de modo que se puedan usar tanto desde la API como desde Server
 * Components.
 *
 * Notas de diseño (decisiones de experto, documentadas):
 * - El modelo `Factura` actual NO guarda la fecha real de pago, por lo que el
 *   DSO y el comportamiento de pago son APROXIMADOS:
 *     · facturas en estado PAGADA se asumen cobradas (días pendientes = 0 hoy);
 *     · facturas PENDIENTE/VENCIDA computan días desde su emisión/vencimiento.
 * - Se excluyen las facturas en estado BORRADOR y ANULADA del cálculo de ventas.
 * - El RFM usa umbrales absolutos (no quintiles) porque la ficha se calcula por
 *   cliente; el ranking relativo entre clientes queda para una vista global/Fase
 *   de reportes.
 */

export type EstadoFacturaLike =
  | 'BORRADOR'
  | 'PENDIENTE'
  | 'PENDIENTE_CAE'
  | 'EMITIDA'
  | 'RECHAZADA'
  | 'PAGADA'
  | 'VENCIDA'
  | 'ANULADA'

export interface ItemFacturaInput {
  descripcion: string
  cantidad: number
  subtotal: number
}

export interface FacturaInput {
  estado: EstadoFacturaLike
  total: number
  fechaEmision: Date | string
  fechaVencimiento?: Date | string | null
  items?: ItemFacturaInput[]
}

export interface TopProducto {
  descripcion: string
  cantidad: number
  monto: number
}

export interface AgingDeuda {
  bucket0_30: number
  bucket31_60: number
  bucket61_90: number
  bucket90: number
}

export type SemaforoPago = 'VERDE' | 'AMARILLO' | 'ROJO'

export type SegmentoCliente =
  | 'VIP'
  | 'RECURRENTE'
  | 'NUEVO'
  | 'EN_RIESGO'
  | 'MOROSO'
  | 'INACTIVO'

export interface MetricasCliente {
  // Valor
  totalComprado: number // LTV (histórico facturado, sin anuladas/borradores)
  cantidadCompras: number
  ticketPromedio: number
  // Recurrencia
  primeraCompra: string | null
  ultimaCompra: string | null
  diasDesdeUltimaCompra: number | null
  frecuenciaMediaDias: number | null
  proximaCompraEstimada: string | null
  enRiesgo: boolean // superó 1.5× su frecuencia normal sin comprar
  // Pago
  saldoActual: number // pendiente + vencido
  deudaVencida: number
  aging: AgingDeuda
  dsoAprox: number // días promedio que tardan/llevan en pagar (aprox)
  scorePago: number // 0-100 (puntualidad)
  semaforoPago: SemaforoPago
  limiteCredito: number | null
  creditoDisponible: number | null
  // Segmentación
  rfm: { recencia: number; frecuencia: number; monto: number; score: number }
  segmento: SegmentoCliente
  // Productos
  topProductos: TopProducto[]
}

const DIA_MS = 24 * 60 * 60 * 1000

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v)
}

function diffDias(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DIA_MS)
}

/** Estados que cuentan como "venta" para LTV/recurrencia. */
function esVenta(estado: EstadoFacturaLike): boolean {
  return estado === 'PAGADA' || estado === 'EMITIDA' || estado === 'PENDIENTE' || estado === 'VENCIDA' || estado === 'PENDIENTE_CAE'
}

/** Estados que representan deuda viva. */
function esDeuda(estado: EstadoFacturaLike): boolean {
  return estado === 'PENDIENTE' || estado === 'VENCIDA' || estado === 'EMITIDA' || estado === 'PENDIENTE_CAE'
}

export interface CalcularMetricasOpts {
  limiteCredito?: number | null
  ahora?: Date
}

export function calcularMetricasCliente(
  facturas: FacturaInput[],
  opts: CalcularMetricasOpts = {},
): MetricasCliente {
  const ahora = opts.ahora ?? new Date()
  const limiteCredito = opts.limiteCredito ?? null

  const ventas = facturas
    .filter((f) => esVenta(f.estado))
    .map((f) => ({ ...f, fecha: toDate(f.fechaEmision) }))
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())

  const totalComprado = ventas.reduce((acc, f) => acc + f.total, 0)
  const cantidadCompras = ventas.length
  const ticketPromedio = cantidadCompras > 0 ? totalComprado / cantidadCompras : 0

  const primeraCompra = ventas[0]?.fecha ?? null
  const ultimaCompra = ventas[ventas.length - 1]?.fecha ?? null
  const diasDesdeUltimaCompra = ultimaCompra ? diffDias(ahora, ultimaCompra) : null

  // Frecuencia media = días entre primera y última, dividido por (n-1)
  let frecuenciaMediaDias: number | null = null
  if (primeraCompra && ultimaCompra && cantidadCompras > 1) {
    const span = diffDias(ultimaCompra, primeraCompra)
    frecuenciaMediaDias = Math.max(1, Math.round(span / (cantidadCompras - 1)))
  }

  let proximaCompraEstimada: Date | null = null
  let enRiesgo = false
  if (ultimaCompra && frecuenciaMediaDias) {
    proximaCompraEstimada = new Date(ultimaCompra.getTime() + frecuenciaMediaDias * DIA_MS)
    if (diasDesdeUltimaCompra !== null && diasDesdeUltimaCompra > frecuenciaMediaDias * 1.5) {
      enRiesgo = true
    }
  }

  // ---- Pago / aging ----
  const aging: AgingDeuda = { bucket0_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90: 0 }
  let saldoActual = 0
  let deudaVencida = 0
  let sumaDiasPendientes = 0
  let cantPendientes = 0

  for (const f of facturas) {
    if (!esDeuda(f.estado)) continue
    saldoActual += f.total
    const ref = f.fechaVencimiento ? toDate(f.fechaVencimiento) : toDate(f.fechaEmision)
    const diasVencido = diffDias(ahora, ref)
    if (f.estado === 'VENCIDA' || diasVencido > 0) deudaVencida += f.total
    const d = Math.max(0, diasVencido)
    if (d <= 30) aging.bucket0_30 += f.total
    else if (d <= 60) aging.bucket31_60 += f.total
    else if (d <= 90) aging.bucket61_90 += f.total
    else aging.bucket90 += f.total
    sumaDiasPendientes += Math.max(0, diffDias(ahora, toDate(f.fechaEmision)))
    cantPendientes += 1
  }

  const dsoAprox = cantPendientes > 0 ? Math.round(sumaDiasPendientes / cantPendientes) : 0

  // Score de pago 0-100: proporción de facturas no morosas, penalizando vencidas
  const facturasConSentidoPago = facturas.filter((f) => esVenta(f.estado))
  let scorePago = 100
  if (facturasConSentidoPago.length > 0) {
    const vencidas = facturasConSentidoPago.filter((f) => {
      if (f.estado === 'VENCIDA') return true
      if (f.estado === 'PENDIENTE' && f.fechaVencimiento) {
        return diffDias(ahora, toDate(f.fechaVencimiento)) > 0
      }
      return false
    }).length
    scorePago = Math.round(((facturasConSentidoPago.length - vencidas) / facturasConSentidoPago.length) * 100)
  }

  const semaforoPago: SemaforoPago =
    deudaVencida > 0 || scorePago < 60 ? 'ROJO' : scorePago < 85 ? 'AMARILLO' : 'VERDE'

  const creditoDisponible = limiteCredito !== null ? limiteCredito - saldoActual : null

  // ---- RFM (umbrales absolutos) ----
  const rfm = {
    recencia: puntajeRecencia(diasDesdeUltimaCompra),
    frecuencia: puntajeFrecuencia(cantidadCompras),
    monto: puntajeMonto(totalComprado),
    score: 0,
  }
  rfm.score = rfm.recencia + rfm.frecuencia + rfm.monto // 3..15

  // ---- Segmento automático ----
  const segmento = calcularSegmento({
    cantidadCompras,
    diasDesdeUltimaCompra,
    deudaVencida,
    rfmScore: rfm.score,
    enRiesgo,
  })

  // ---- Top productos ----
  const acc = new Map<string, TopProducto>()
  for (const f of facturas) {
    if (!esVenta(f.estado)) continue
    for (const it of f.items ?? []) {
      const key = it.descripcion.trim().toLowerCase()
      const prev = acc.get(key) ?? { descripcion: it.descripcion, cantidad: 0, monto: 0 }
      prev.cantidad += it.cantidad
      prev.monto += it.subtotal
      acc.set(key, prev)
    }
  }
  const topProductos = Array.from(acc.values())
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 10)

  return {
    totalComprado,
    cantidadCompras,
    ticketPromedio,
    primeraCompra: primeraCompra ? primeraCompra.toISOString() : null,
    ultimaCompra: ultimaCompra ? ultimaCompra.toISOString() : null,
    diasDesdeUltimaCompra,
    frecuenciaMediaDias,
    proximaCompraEstimada: proximaCompraEstimada ? proximaCompraEstimada.toISOString() : null,
    enRiesgo,
    saldoActual,
    deudaVencida,
    aging,
    dsoAprox,
    scorePago,
    semaforoPago,
    limiteCredito,
    creditoDisponible,
    rfm,
    segmento,
    topProductos,
  }
}

function puntajeRecencia(dias: number | null): number {
  if (dias === null) return 1
  if (dias <= 30) return 5
  if (dias <= 60) return 4
  if (dias <= 120) return 3
  if (dias <= 240) return 2
  return 1
}

function puntajeFrecuencia(compras: number): number {
  if (compras >= 12) return 5
  if (compras >= 6) return 4
  if (compras >= 3) return 3
  if (compras >= 1) return 2
  return 1
}

function puntajeMonto(total: number): number {
  if (total >= 1_000_000) return 5
  if (total >= 500_000) return 4
  if (total >= 200_000) return 3
  if (total >= 50_000) return 2
  return 1
}

function calcularSegmento(args: {
  cantidadCompras: number
  diasDesdeUltimaCompra: number | null
  deudaVencida: number
  rfmScore: number
  enRiesgo: boolean
}): SegmentoCliente {
  const { cantidadCompras, diasDesdeUltimaCompra, deudaVencida, rfmScore, enRiesgo } = args
  if (cantidadCompras === 0) return 'INACTIVO'
  if (deudaVencida > 0) return 'MOROSO'
  if (rfmScore >= 12) return 'VIP'
  if (enRiesgo || (diasDesdeUltimaCompra !== null && diasDesdeUltimaCompra > 180)) return 'EN_RIESGO'
  if (cantidadCompras >= 3) return 'RECURRENTE'
  return 'NUEVO'
}

export const LABEL_SEGMENTO: Record<SegmentoCliente, string> = {
  VIP: 'VIP',
  RECURRENTE: 'Recurrente',
  NUEVO: 'Nuevo',
  EN_RIESGO: 'En riesgo',
  MOROSO: 'Moroso',
  INACTIVO: 'Inactivo',
}
