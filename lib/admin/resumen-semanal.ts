/**
 * Resumen semanal admin por email — KPIs operativos, dedup semanal, no bloquea cron.
 */

import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { registrarError } from '@/lib/error-log'
import { sendSystemEmail, getAdminNotifyEmails } from '@/lib/mail/system-mail'
import { contarAdvertenciasIntegridad } from '@/lib/admin/integridad-advertencias'

const ORIGEN = 'admin-resumen-semanal'
const PREFIX = 'resumen-semanal:'

function claveSemana(dia = new Date()): string {
  return `${PREFIX}${format(dia, 'yyyy-ww')}`
}

async function yaEnviadoEstaSemana(): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: { origen: ORIGEN, mensaje: { startsWith: `${claveSemana()}:ok` } },
    select: { id: true },
  })
  return Boolean(prev)
}

async function marcarEnviado(emails: string[]): Promise<void> {
  await registrarError({
    nivel: NivelLog.INFO,
    origen: ORIGEN,
    mensaje: `${claveSemana()}:ok`,
    metadata: { emails },
  })
}

export type ResumenSemanalKpis = {
  ventasMesActual: number
  cuotasVencidas: number
  otsAbiertas: number
  advertenciasIntegridad: number
}

export async function obtenerKpisResumenSemanal(): Promise<ResumenSemanalKpis> {
  const ahora = new Date()
  const inicioMes = startOfMonth(ahora)
  const finMes = endOfMonth(ahora)

  const [ventasAgg, cuotasVencidas, otsAbiertas, advertenciasIntegridad] = await Promise.all([
    prisma.factura.aggregate({
      where: {
        estado: { in: ['EMITIDA', 'PAGADA'] },
        fechaEmision: { gte: inicioMes, lte: finMes },
      },
      _sum: { total: true },
    }),
    prisma.vencimientoCobranza.count({
      where: {
        estado: { in: ['PENDIENTE', 'AVISO_ENVIADO'] },
        fechaVencimiento: { lt: ahora },
        factura: { estado: { in: ['EMITIDA', 'VENCIDA', 'PENDIENTE'] } },
      },
    }),
    prisma.ordenTrabajo.count({ where: { estado: { in: ['ABIERTA', 'EN_PROCESO'] } } }),
    contarAdvertenciasIntegridad(),
  ])

  return {
    ventasMesActual: Number(ventasAgg._sum.total ?? 0),
    cuotasVencidas,
    otsAbiertas,
    advertenciasIntegridad,
  }
}

function formatearMonto(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function textoResumen(kpis: ResumenSemanalKpis, appUrl: string): { subject: string; text: string } {
  const mesLabel = format(new Date(), 'MMMM yyyy', { locale: es })
  const subject = `iBiomédica ERP — Resumen semanal (${mesLabel})`
  const text = [
    'Resumen semanal del ERP iBiomédica',
    '',
    `Ventas del mes (${mesLabel}): ARS ${formatearMonto(kpis.ventasMesActual)}`,
    `Cuotas vencidas impagas: ${kpis.cuotasVencidas}`,
    `OTs abiertas (ABIERTA / EN_PROCESO): ${kpis.otsAbiertas}`,
    `Advertencias de integridad (I2–I5, Pr3): ${kpis.advertenciasIntegridad}`,
    '',
    `Panel: ${appUrl}/dashboard`,
    `Integridad: ${appUrl}/configuracion`,
    '',
    '— Sistema iBiomédica ERP',
  ].join('\n')
  return { subject, text }
}

export type ProcesarResumenSemanalResult = {
  enviado: boolean
  omitido: boolean
  motivo?: string
  kpis?: ResumenSemanalKpis
}

export async function procesarResumenSemanalAdmin(): Promise<ProcesarResumenSemanalResult> {
  if (await yaEnviadoEstaSemana()) {
    return { enviado: false, omitido: true, motivo: 'ya_enviado_esta_semana' }
  }

  const destinatarios = await getAdminNotifyEmails()
  if (destinatarios.length === 0) {
    return { enviado: false, omitido: true, motivo: 'sin_destinatarios' }
  }

  const kpis = await obtenerKpisResumenSemanal()
  const appUrl = (process.env.NEXTAUTH_URL ?? 'https://erp-ibiomedica.com.ar').replace(/\/$/, '')
  const { subject, text } = textoResumen(kpis, appUrl)

  const ok = await sendSystemEmail({ to: destinatarios, subject, text })
  if (!ok) {
    return { enviado: false, omitido: true, motivo: 'smtp_no_configurado', kpis }
  }

  await marcarEnviado(destinatarios)
  return { enviado: true, omitido: false, kpis }
}
