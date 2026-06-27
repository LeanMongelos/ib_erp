import { prisma } from '@/lib/prisma'
import { redondear2 } from '@/lib/utils'
import { acumularSaldoPorMoneda, type SaldoPorMoneda } from '@/lib/compras/moneda-compra'

export type AgingBucketId = '0-30' | '31-60' | '61-90' | '90+'

export interface VencimientoApRow {
  id: string
  facturaCompraId: string
  facturaNumero: string
  proveedorId: string
  proveedor: string
  moneda: string
  fecha: string
  monto: number
  saldo: number
  diasVencido: number
  bucket: AgingBucketId
}

export interface AgingResumen {
  bucket: AgingBucketId
  label: string
  moneda: string
  monto: number
  cantidad: number
}

export interface CuentaCorrienteProveedor {
  proveedorId: string
  proveedor: string
  saldoPendiente: number
  saldosPorMoneda: SaldoPorMoneda
  vencidos: number
  porVencer: number
  aging: AgingResumen[]
  vencimientos: VencimientoApRow[]
}

export interface CuentaCorrienteGlobal {
  saldoTotal: number
  saldosPorMoneda: SaldoPorMoneda
  proveedores: CuentaCorrienteProveedor[]
  agingGlobal: AgingResumen[]
}

const BUCKET_LABELS: Record<AgingBucketId, string> = {
  '0-30': '0–30 días',
  '31-60': '31–60 días',
  '61-90': '61–90 días',
  '90+': 'Más de 90 días',
}

function diasDesde(fecha: Date, ahora = new Date()): number {
  const ms = ahora.getTime() - fecha.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/** Lógica pura para tests: bucket según días desde vencimiento (negativo = aún no venció). */
export function bucketAging(diasVencido: number): AgingBucketId {
  if (diasVencido <= 30) return '0-30'
  if (diasVencido <= 60) return '31-60'
  if (diasVencido <= 90) return '61-90'
  return '90+'
}

function emptyAging(moneda = 'ARS'): AgingResumen[] {
  return (['0-30', '31-60', '61-90', '90+'] as AgingBucketId[]).map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    moneda,
    monto: 0,
    cantidad: 0,
  }))
}

function acumularAging(rows: VencimientoApRow[]): AgingResumen[] {
  const porMoneda = new Map<string, AgingResumen[]>()

  for (const row of rows) {
    const moneda = row.moneda || 'ARS'
    if (!porMoneda.has(moneda)) {
      porMoneda.set(moneda, emptyAging(moneda))
    }
    const buckets = porMoneda.get(moneda)!
    const b = buckets.find((x) => x.bucket === row.bucket)!
    b.monto = redondear2(b.monto + row.saldo)
    b.cantidad += 1
  }

  return [...porMoneda.values()].flat()
}

function sumarSaldosPorMoneda(rows: VencimientoApRow[]): SaldoPorMoneda {
  const out: SaldoPorMoneda = {}
  for (const row of rows) {
    const m = row.moneda || 'ARS'
    out[m] = redondear2((out[m] ?? 0) + row.saldo)
  }
  return out
}

export async function consultarCuentaCorriente(proveedorId?: string): Promise<CuentaCorrienteGlobal> {
  const ahora = new Date()

  const vencimientos = await prisma.vencimientoPago.findMany({
    where: {
      pagado: false,
      saldo: { gt: 0.009 },
      facturaCompra: {
        estado: 'REGISTRADA',
        ...(proveedorId && { proveedorId }),
      },
    },
    include: {
      facturaCompra: {
        select: {
          id: true,
          numero: true,
          moneda: true,
          proveedorId: true,
          proveedor: { select: { razonSocial: true } },
        },
      },
    },
    orderBy: [{ fecha: 'asc' }],
  })

  const porProveedor = new Map<string, VencimientoApRow[]>()

  for (const v of vencimientos) {
    const diasVencido = diasDesde(v.fecha, ahora)
    const moneda = v.facturaCompra.moneda || 'ARS'
    const row: VencimientoApRow = {
      id: v.id,
      facturaCompraId: v.facturaCompra.id,
      facturaNumero: v.facturaCompra.numero,
      proveedorId: v.facturaCompra.proveedorId,
      proveedor: v.facturaCompra.proveedor.razonSocial,
      moneda,
      fecha: v.fecha.toISOString(),
      monto: v.monto,
      saldo: v.saldo,
      diasVencido,
      bucket: bucketAging(Math.max(0, diasVencido)),
    }
    const list = porProveedor.get(row.proveedorId) ?? []
    list.push(row)
    porProveedor.set(row.proveedorId, list)
  }

  const proveedores: CuentaCorrienteProveedor[] = []
  const allRows: VencimientoApRow[] = []

  for (const [pid, rows] of porProveedor) {
    allRows.push(...rows)
    const saldosPorMoneda = sumarSaldosPorMoneda(rows)
    const saldoPendiente = Object.values(saldosPorMoneda).reduce((a, v) => a + v, 0)
    const vencidos = rows.filter((r) => r.diasVencido > 0).length
    const porVencer = rows.filter((r) => r.diasVencido <= 0).length
    proveedores.push({
      proveedorId: pid,
      proveedor: rows[0]?.proveedor ?? '',
      saldoPendiente: redondear2(saldoPendiente),
      saldosPorMoneda,
      vencidos,
      porVencer,
      aging: acumularAging(rows),
      vencimientos: rows,
    })
  }

  proveedores.sort((a, b) => b.saldoPendiente - a.saldoPendiente)

  const saldosPorMoneda = sumarSaldosPorMoneda(allRows)

  return {
    saldoTotal: redondear2(Object.values(saldosPorMoneda).reduce((a, v) => a + v, 0)),
    saldosPorMoneda,
    proveedores,
    agingGlobal: acumularAging(allRows),
  }
}

export async function resumenCuentaCorrienteProveedor(proveedorId: string) {
  const cc = await consultarCuentaCorriente(proveedorId)
  const prov = cc.proveedores[0]
  if (!prov) {
    return {
      saldoPendiente: 0,
      saldosPorMoneda: {} as SaldoPorMoneda,
      vencidos: 0,
      porVencer: 0,
      aging: [] as AgingResumen[],
      vencimientos: [] as VencimientoApRow[],
    }
  }
  return {
    saldoPendiente: prov.saldoPendiente,
    saldosPorMoneda: prov.saldosPorMoneda,
    vencidos: prov.vencidos,
    porVencer: prov.porVencer,
    aging: prov.aging,
    vencimientos: prov.vencimientos,
  }
}

export { acumularSaldoPorMoneda }
