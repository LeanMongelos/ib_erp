import { prisma } from '@/lib/prisma'
import type { EstadoFactura } from '@prisma/client'
import { enviarAvisoVencimiento } from '@/lib/cobranzas/notify-vencimiento'
import { marcarFacturasVencidasPorCuota } from '@/lib/cobranzas/marcar-facturas-vencidas'
import {
  fechaLimiteProximosRecordatorios,
  notifyClienteRecordatorioProximo,
  notifyClienteRecordatorioVencido,
  type VencimientoRecordatorio,
} from '@/lib/cobranzas/notify-cliente-recordatorio'

const ESTADOS_FACTURA_COBRABLE: EstadoFactura[] = [
  'BORRADOR',
  'PENDIENTE',
  'PENDIENTE_CAE',
  'EMITIDA',
  'VENCIDA',
  'RECHAZADA',
]

const ESTADOS_FACTURA_CLIENTE: EstadoFactura[] = ['EMITIDA', 'VENCIDA']

const includeRecordatorio = {
  factura: {
    include: {
      cliente: { select: { nombre: true } },
    },
  },
} as const

export type ResultadoProcesarVencimientos = {
  enviados: number
  revisados: number
  facturasMarcadasVencidas: number
  recordatoriosClienteVencidos: number
  recordatoriosClienteProximos: number
}

/**
 * Cron/worker idempotente:
 * 1. Marca facturas EMITIDA → VENCIDA si hay cuota impaga vencida
 * 2. Aviso interno a cobranzas (Guillermo + Lucas) por cuota vencida PENDIENTE
 * 3. Email recordatorio al cliente (vencido + próximo a vencer)
 */
export async function procesarVencimientosDelDia(): Promise<ResultadoProcesarVencimientos> {
  const ahora = new Date()
  const facturasMarcadasVencidas = await marcarFacturasVencidasPorCuota()

  const pendientes = await prisma.vencimientoCobranza.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lte: ahora },
      factura: { estado: { in: ESTADOS_FACTURA_COBRABLE } },
    },
    include: includeRecordatorio,
    orderBy: [{ fechaVencimiento: 'asc' }, { numeroCuota: 'asc' }],
  })

  let enviados = 0
  for (const v of pendientes) {
    const ok = await enviarAvisoVencimiento(v)
    if (ok) {
      await prisma.vencimientoCobranza.update({
        where: { id: v.id },
        data: { estado: 'AVISO_ENVIADO', avisoEnviadoEn: new Date() },
      })
      enviados++
      console.log(
        `[cobranzas] Aviso interno — ${v.factura.numero} cuota ${v.numeroCuota} (día ${v.diasDesdeEmision})`,
      )
    } else {
      console.warn(
        `[cobranzas] No se pudo enviar aviso interno — ${v.factura.numero} cuota ${v.numeroCuota}`,
      )
    }
  }

  const cuotasVencidasCliente = await prisma.vencimientoCobranza.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
      fechaVencimiento: { lte: ahora },
      factura: { estado: { in: ESTADOS_FACTURA_CLIENTE } },
    },
    include: includeRecordatorio,
    orderBy: [{ fechaVencimiento: 'asc' }, { numeroCuota: 'asc' }],
  })

  let recordatoriosClienteVencidos = 0
  for (const v of cuotasVencidasCliente) {
    const ok = await notifyClienteRecordatorioVencido(v as VencimientoRecordatorio)
    if (ok) {
      recordatoriosClienteVencidos++
      console.log(
        `[cobranzas] Recordatorio cliente (vencido) — ${v.factura.numero} cuota ${v.numeroCuota}`,
      )
    }
  }

  const limiteProximos = await fechaLimiteProximosRecordatorios(ahora)
  const cuotasProximasCliente = await prisma.vencimientoCobranza.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
      fechaVencimiento: { gt: ahora, lte: limiteProximos },
      factura: { estado: { in: ESTADOS_FACTURA_CLIENTE } },
    },
    include: includeRecordatorio,
    orderBy: [{ fechaVencimiento: 'asc' }, { numeroCuota: 'asc' }],
  })

  let recordatoriosClienteProximos = 0
  for (const v of cuotasProximasCliente) {
    const ok = await notifyClienteRecordatorioProximo(v as VencimientoRecordatorio)
    if (ok) {
      recordatoriosClienteProximos++
      console.log(
        `[cobranzas] Recordatorio cliente (próximo) — ${v.factura.numero} cuota ${v.numeroCuota}`,
      )
    }
  }

  return {
    enviados,
    revisados: pendientes.length,
    facturasMarcadasVencidas,
    recordatoriosClienteVencidos,
    recordatoriosClienteProximos,
  }
}
