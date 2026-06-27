import { prisma } from '@/lib/prisma'
import { redondear2 } from '@/lib/utils'
import { acumularSaldoPorMoneda, type SaldoPorMoneda } from '@/lib/compras/moneda-compra'
import type {
  EventoHistorialAp,
  HistorialApResult,
  KpisHistorialAp,
  TipoEventoAp,
} from '@/lib/compras/historial-ap-types'

export type { EventoHistorialAp, HistorialApResult, KpisHistorialAp, TipoEventoAp } from '@/lib/compras/historial-ap-types'
export { labelEventoAp } from '@/lib/compras/historial-ap-types'

interface EventoRaw {
  tipo: TipoEventoAp
  fecha: Date
  monto?: number
  moneda?: string
  referencia: string
  id: string
  href: string
  deltaSaldo?: number
}

function computeRunningSaldo(eventos: EventoRaw[]): EventoHistorialAp[] {
  const saldos: SaldoPorMoneda = {}
  const sorted = [...eventos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime())

  return sorted.map((ev) => {
    const moneda = ev.moneda ?? 'ARS'
    if (ev.deltaSaldo != null && ev.deltaSaldo !== 0) {
      const next = acumularSaldoPorMoneda(saldos, moneda, ev.deltaSaldo)
      Object.assign(saldos, next)
    }
    return {
      tipo: ev.tipo,
      fecha: ev.fecha.toISOString(),
      monto: ev.monto,
      moneda,
      saldoAcumulado: redondear2(saldos[moneda] ?? 0),
      referencia: ev.referencia,
      id: ev.id,
      href: ev.href,
    }
  })
}

function calcularKpis(eventos: EventoHistorialAp[], saldosPorMoneda: SaldoPorMoneda): KpisHistorialAp[] {
  const monedas = [...new Set([
    ...Object.keys(saldosPorMoneda),
    ...eventos.map((e) => e.moneda ?? 'ARS'),
  ])]

  return monedas.map((moneda) => {
    const evMoneda = eventos.filter((e) => (e.moneda ?? 'ARS') === moneda)
    const deudaGenerada = evMoneda
      .filter((e) => e.tipo === 'FC_REGISTRADA')
      .reduce((a, e) => a + (e.monto ?? 0), 0)
    const pagada = evMoneda
      .filter((e) => e.tipo === 'PAGO')
      .reduce((a, e) => a + (e.monto ?? 0), 0)
    return {
      moneda,
      deudaGenerada: redondear2(deudaGenerada),
      pagada: redondear2(pagada),
      pendienteHoy: redondear2(saldosPorMoneda[moneda] ?? 0),
    }
  })
}

export async function construirHistorialAp(proveedorId: string): Promise<HistorialApResult> {
  const [ocs, facturas, pagos] = await Promise.all([
    prisma.ordenCompra.findMany({
      where: { proveedorId },
      select: {
        id: true,
        numero: true,
        moneda: true,
        creadoEn: true,
        aprobadoEn: true,
        ultimaRecepcionEn: true,
        estado: true,
      },
      orderBy: { creadoEn: 'asc' },
    }),
    prisma.facturaCompra.findMany({
      where: { proveedorId },
      select: {
        id: true,
        numero: true,
        moneda: true,
        total: true,
        estado: true,
        registradaEn: true,
        anuladaEn: true,
        vencimientos: {
          select: { id: true, numeroCuota: true, monto: true, creadoEn: true },
        },
      },
      orderBy: { creadoEn: 'asc' },
    }),
    prisma.pagoProveedor.findMany({
      where: { proveedorId, estado: 'REGISTRADO' },
      select: {
        id: true,
        monto: true,
        moneda: true,
        fecha: true,
        referencia: true,
      },
      orderBy: { fecha: 'asc' },
    }),
  ])

  const raw: EventoRaw[] = []

  for (const oc of ocs) {
    raw.push({
      tipo: 'OC_CREADA',
      fecha: oc.creadoEn,
      referencia: oc.numero,
      id: oc.id,
      href: `/compras?tab=oc`,
      moneda: oc.moneda,
    })
    if (oc.aprobadoEn) {
      raw.push({
        tipo: 'OC_APROBADA',
        fecha: oc.aprobadoEn,
        referencia: oc.numero,
        id: `${oc.id}-aprob`,
        href: `/compras?tab=oc`,
        moneda: oc.moneda,
      })
    }
    if (oc.ultimaRecepcionEn) {
      raw.push({
        tipo: 'OC_RECEPCION',
        fecha: oc.ultimaRecepcionEn,
        referencia: oc.numero,
        id: `${oc.id}-recv`,
        href: `/compras?tab=oc`,
        moneda: oc.moneda,
      })
    }
  }

  for (const fc of facturas) {
    const moneda = fc.moneda || 'ARS'
    if (fc.registradaEn && fc.estado !== 'BORRADOR') {
      raw.push({
        tipo: 'FC_REGISTRADA',
        fecha: fc.registradaEn,
        monto: fc.total,
        moneda,
        referencia: fc.numero,
        id: fc.id,
        href: `/compras?tab=facturas`,
        deltaSaldo: fc.total,
      })
    }
    for (const v of fc.vencimientos) {
      raw.push({
        tipo: 'VENCIMIENTO_CREADO',
        fecha: v.creadoEn,
        monto: v.monto,
        moneda,
        referencia: `${fc.numero} · cuota ${v.numeroCuota}`,
        id: v.id,
        href: `/compras?tab=facturas`,
      })
    }
    if (fc.anuladaEn && fc.estado === 'ANULADA') {
      raw.push({
        tipo: 'FC_ANULADA',
        fecha: fc.anuladaEn,
        monto: fc.total,
        moneda,
        referencia: fc.numero,
        id: `${fc.id}-anul`,
        href: `/compras?tab=facturas`,
        deltaSaldo: -fc.total,
      })
    }
  }

  for (const p of pagos) {
    raw.push({
      tipo: 'PAGO',
      fecha: p.fecha,
      monto: p.monto,
      moneda: p.moneda || 'ARS',
      referencia: p.referencia?.trim() || 'Pago a proveedor',
      id: p.id,
      href: `/compras?tab=pagos`,
      deltaSaldo: -p.monto,
    })
  }

  const eventos = computeRunningSaldo(raw)
  const saldosPorMoneda: SaldoPorMoneda = {}
  for (const ev of eventos) {
    const m = ev.moneda ?? 'ARS'
    if (ev.saldoAcumulado != null) {
      saldosPorMoneda[m] = ev.saldoAcumulado
    }
  }

  return {
    eventos: eventos.reverse(),
    saldosPorMoneda,
    kpis: calcularKpis(eventos, saldosPorMoneda),
  }
}
