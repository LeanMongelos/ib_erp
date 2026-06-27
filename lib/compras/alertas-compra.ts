import { addDays, differenceInCalendarDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { ocEstaAprobada, ocTieneRecepcion } from '@/lib/compras/factura-compra'

export const UMBRALES_ALERTA_COMPRA = [3, 5, 7] as const
export const UMBRALES_CHEQUE_DEBITO = [1, 3, 7] as const
export const UMBRAL_AP_PROXIMO_DIAS = 7

export type TipoAlertaCompra =
  | 'FC_PENDIENTE_RECEPCION'
  | 'FC_PENDIENTE_REGISTRO'
  | 'CHEQUE_PROXIMO_DEBITO'
  | 'AP_VENCIDA'
  | 'AP_PROXIMO'

export interface AlertaCompra {
  alertKey: string
  tipo: TipoAlertaCompra
  diasAlerta: number
  diasTranscurridos: number
  ordenCompraId?: string
  facturaCompraId?: string
  chequeEmitidoId?: string
  vencimientoPagoId?: string
  numero: string
  proveedorId: string
  proveedor: string
  fechaReferencia: string
  mensaje: string
  monto?: number
}

function diasDesde(fecha: Date, ahora = new Date()): number {
  const ms = ahora.getTime() - fecha.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function diasHasta(fecha: Date, ahora = new Date()): number {
  const ms = fecha.getTime() - ahora.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function umbralAlcanzado(dias: number, umbrales: readonly number[]): number | null {
  let hit: number | null = null
  for (const u of umbrales) {
    if (dias >= u) hit = u
  }
  return hit
}

function umbralChequeProximo(diasRestantes: number): number | null {
  if (diasRestantes < 0) return null
  if (diasRestantes <= 1) return 1
  if (diasRestantes <= 3) return 3
  if (diasRestantes <= 7) return 7
  return null
}

/** Clave estable para dismiss — por entidad, no por umbral de días. */
export function generarAlertKey(alerta: Pick<AlertaCompra, 'tipo' | 'ordenCompraId' | 'facturaCompraId' | 'chequeEmitidoId' | 'vencimientoPagoId' | 'numero'>): string {
  if (alerta.vencimientoPagoId) return `${alerta.tipo}:${alerta.vencimientoPagoId}`
  if (alerta.ordenCompraId) return `${alerta.tipo}:${alerta.ordenCompraId}`
  if (alerta.facturaCompraId) return `${alerta.tipo}:${alerta.facturaCompraId}`
  if (alerta.chequeEmitidoId) return `${alerta.tipo}:${alerta.chequeEmitidoId}`
  return `${alerta.tipo}:${alerta.numero}`
}

function withKey(partial: Omit<AlertaCompra, 'alertKey'>): AlertaCompra {
  return { ...partial, alertKey: generarAlertKey(partial) }
}

async function obtenerDismissKeys(usuarioId?: string): Promise<Set<string>> {
  if (!usuarioId) return new Set()
  const rows = await prisma.alertaCompraDismiss.findMany({
    where: { dismissedById: usuarioId },
    select: { alertKey: true },
  })
  return new Set(rows.map((r) => r.alertKey))
}

async function consultarAlertasAP(ahora = new Date()): Promise<AlertaCompra[]> {
  const alertas: AlertaCompra[] = []
  const limiteProximo = addDays(ahora, UMBRAL_AP_PROXIMO_DIAS)

  const vencidas = await prisma.vencimientoPago.findMany({
    where: {
      saldo: { gt: 0.009 },
      pagado: false,
      fecha: { lt: ahora },
      facturaCompra: { estado: 'REGISTRADA' },
    },
    include: {
      facturaCompra: {
        select: {
          id: true,
          numero: true,
          proveedorId: true,
          proveedor: { select: { razonSocial: true } },
        },
      },
    },
    take: 20,
    orderBy: { fecha: 'asc' },
  })

  for (const v of vencidas) {
    const fc = v.facturaCompra
    const dias = differenceInCalendarDays(ahora, v.fecha)
    alertas.push(withKey({
      tipo: 'AP_VENCIDA',
      diasAlerta: dias,
      diasTranscurridos: dias,
      vencimientoPagoId: v.id,
      facturaCompraId: fc.id,
      numero: fc.numero,
      proveedorId: fc.proveedorId,
      proveedor: fc.proveedor.razonSocial,
      fechaReferencia: v.fecha.toISOString(),
      monto: v.saldo,
      mensaje: `Cuota ${v.numeroCuota} vencida — FC ${fc.numero} (${fc.proveedor.razonSocial}) · saldo ${v.saldo.toFixed(2)}`,
    }))
  }

  const proximas = await prisma.vencimientoPago.findMany({
    where: {
      saldo: { gt: 0.009 },
      pagado: false,
      fecha: { gte: ahora, lte: limiteProximo },
      facturaCompra: { estado: 'REGISTRADA' },
    },
    include: {
      facturaCompra: {
        select: {
          id: true,
          numero: true,
          proveedorId: true,
          proveedor: { select: { razonSocial: true } },
        },
      },
    },
    take: 15,
    orderBy: { fecha: 'asc' },
  })

  for (const v of proximas) {
    const fc = v.facturaCompra
    const dias = differenceInCalendarDays(v.fecha, ahora)
    alertas.push(withKey({
      tipo: 'AP_PROXIMO',
      diasAlerta: dias,
      diasTranscurridos: 0,
      vencimientoPagoId: v.id,
      facturaCompraId: fc.id,
      numero: fc.numero,
      proveedorId: fc.proveedorId,
      proveedor: fc.proveedor.razonSocial,
      fechaReferencia: v.fecha.toISOString(),
      monto: v.saldo,
      mensaje: `Cuota ${v.numeroCuota} vence en ${dias}d — FC ${fc.numero} (${fc.proveedor.razonSocial})`,
    }))
  }

  return alertas
}

export async function consultarAlertasCompra(usuarioId?: string): Promise<AlertaCompra[]> {
  const ahora = new Date()
  const alertas: AlertaCompra[] = []

  const ordenes = await prisma.ordenCompra.findMany({
    where: {
      estado: { in: ['APROBADA', 'ENVIADA', 'PARCIAL', 'RECIBIDA'] },
    },
    include: {
      proveedor: { select: { id: true, razonSocial: true } },
      items: { select: { cantidadRecibida: true } },
      facturasCompra: {
        where: { estado: { in: ['BORRADOR', 'REGISTRADA'] } },
        select: { id: true, estado: true },
      },
    },
  })

  for (const oc of ordenes) {
    if (!ocEstaAprobada(oc.estado)) continue
    if (!ocTieneRecepcion(oc.items)) continue
    const tieneFcRegistrada = oc.facturasCompra.some((f) => f.estado === 'REGISTRADA')
    if (tieneFcRegistrada) continue

    const fechaRef = oc.ultimaRecepcionEn ?? oc.creadoEn
    const dias = diasDesde(fechaRef, ahora)
    const umbral = umbralAlcanzado(dias, UMBRALES_ALERTA_COMPRA)
    if (!umbral) continue

    alertas.push(withKey({
      tipo: 'FC_PENDIENTE_RECEPCION',
      diasAlerta: umbral,
      diasTranscurridos: dias,
      ordenCompraId: oc.id,
      numero: oc.numero,
      proveedorId: oc.proveedorId,
      proveedor: oc.proveedor.razonSocial,
      fechaReferencia: fechaRef.toISOString(),
      mensaje: `OC ${oc.numero} recepcionada hace ${dias} días sin factura de compra registrada`,
    }))
  }

  const facturasBorrador = await prisma.facturaCompra.findMany({
    where: { estado: 'BORRADOR' },
    include: { proveedor: { select: { id: true, razonSocial: true } } },
  })

  for (const fc of facturasBorrador) {
    const fechaRef = fc.alertaFcPendienteEn ?? fc.creadoEn
    const dias = diasDesde(fechaRef, ahora)
    const umbral = umbralAlcanzado(dias, UMBRALES_ALERTA_COMPRA)
    if (!umbral) continue

    alertas.push(withKey({
      tipo: 'FC_PENDIENTE_REGISTRO',
      diasAlerta: umbral,
      diasTranscurridos: dias,
      facturaCompraId: fc.id,
      ordenCompraId: fc.ordenCompraId ?? undefined,
      numero: fc.numero,
      proveedorId: fc.proveedorId,
      proveedor: fc.proveedor.razonSocial,
      fechaReferencia: fechaRef.toISOString(),
      mensaje: `Factura ${fc.numero} en borrador hace ${dias} días sin registrar`,
    }))
  }

  const chequesPendientes = await prisma.chequeEmitido.findMany({
    where: {
      estado: 'EMITIDO',
      fechaDebito: { not: null },
    },
    include: { proveedor: { select: { id: true, razonSocial: true } } },
  })

  for (const ch of chequesPendientes) {
    if (!ch.fechaDebito) continue
    const diasRestantes = diasHasta(ch.fechaDebito, ahora)
    const umbral = umbralChequeProximo(diasRestantes)
    if (!umbral) continue

    const mensaje =
      diasRestantes <= 0
        ? `Cheque ${ch.numero} vence hoy (${ch.proveedor.razonSocial})`
        : `Cheque ${ch.numero} se debita en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} (${ch.proveedor.razonSocial})`

    alertas.push(withKey({
      tipo: 'CHEQUE_PROXIMO_DEBITO',
      diasAlerta: umbral,
      diasTranscurridos: Math.max(0, -diasRestantes),
      chequeEmitidoId: ch.id,
      numero: ch.numero,
      proveedorId: ch.proveedorId,
      proveedor: ch.proveedor.razonSocial,
      fechaReferencia: ch.fechaDebito.toISOString(),
      mensaje,
    }))
  }

  const alertasAP = await consultarAlertasAP(ahora)
  alertas.push(...alertasAP)

  alertas.sort((a, b) => b.diasTranscurridos - a.diasTranscurridos)

  const dismissed = await obtenerDismissKeys(usuarioId)
  if (dismissed.size === 0) return alertas
  return alertas.filter((a) => !dismissed.has(a.alertKey))
}

export async function dismissAlertaCompra(alertKey: string, usuarioId: string) {
  return prisma.alertaCompraDismiss.upsert({
    where: {
      alertKey_dismissedById: { alertKey, dismissedById: usuarioId },
    },
    create: { alertKey, dismissedById: usuarioId },
    update: { dismissedEn: new Date() },
  })
}

/** Lógica pura para tests unitarios de umbrales FC. */
export function evaluarUmbralAlerta(diasTranscurridos: number): number | null {
  return umbralAlcanzado(diasTranscurridos, UMBRALES_ALERTA_COMPRA)
}

/** Lógica pura para tests unitarios de umbrales cheque. */
export function evaluarUmbralChequeDebito(diasRestantes: number): number | null {
  return umbralChequeProximo(diasRestantes)
}
