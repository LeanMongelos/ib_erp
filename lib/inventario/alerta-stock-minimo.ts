/**
 * Alerta admin cuando stock <= stockMinimo.
 * Dedup diaria por artículo vía SystemLog; no bloquea operaciones.
 */

import { format } from 'date-fns'
import { NivelLog } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { registrarError } from '@/lib/error-log'
import { sendSystemEmail, getAdminNotifyEmails } from '@/lib/mail/system-mail'

const ORIGEN = 'inventario-stock-minimo'
const PREFIX = 'stock-minimo:'

export type ArticuloStockBajo = {
  id: string
  nombre: string
  sku: string | null
  stock: number
  stockMinimo: number
}

function alertasHabilitadas(): boolean {
  const v = process.env.STOCK_MINIMO_EMAIL?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'no') return false
  return true
}

function claveDia(articuloId: string, dia = new Date()): string {
  return `${PREFIX}${articuloId}:${format(dia, 'yyyy-MM-dd')}`
}

export async function listarArticulosStockBajo(): Promise<ArticuloStockBajo[]> {
  const items = await prisma.inventario.findMany({
    where: { activo: true, stockMinimo: { gt: 0 } },
    select: { id: true, nombre: true, sku: true, stock: true, stockMinimo: true },
  })
  return items.filter((i) => i.stock <= i.stockMinimo)
}

async function yaEnviadoHoy(articuloId: string): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: { origen: ORIGEN, mensaje: { startsWith: claveDia(articuloId) } },
    select: { id: true },
  })
  return Boolean(prev)
}

async function marcarEnviado(articuloId: string, emails: string[]): Promise<void> {
  await registrarError({
    nivel: NivelLog.INFO,
    origen: ORIGEN,
    mensaje: `${claveDia(articuloId)}:ok`,
    metadata: { articuloId, emails },
  })
}

async function marcarFallo(articuloId: string, detalle: string): Promise<void> {
  await registrarError({
    nivel: NivelLog.WARN,
    origen: ORIGEN,
    mensaje: `${claveDia(articuloId)}:fail`,
    metadata: { articuloId, detalle },
  })
}

async function resolverDestinatarios(): Promise<string[]> {
  const fromEnv = process.env.STOCK_MINIMO_NOTIFY_EMAIL
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromEnv?.length) return fromEnv
  return getAdminNotifyEmails()
}

function textoAlerta(item: ArticuloStockBajo, appUrl: string): { subject: string; text: string } {
  const urgente = item.stock === 0
  const subject = urgente
    ? `[Inventario] Sin stock — ${item.nombre}`
    : `[Inventario] Stock bajo — ${item.nombre}`

  const text = [
    urgente ? 'Artículo sin stock disponible.' : 'Artículo por debajo del stock mínimo.',
    '',
    `Artículo: ${item.nombre}`,
    item.sku ? `SKU: ${item.sku}` : '',
    `Stock actual: ${item.stock} u.`,
    `Stock mínimo: ${item.stockMinimo} u.`,
    '',
    `Ver inventario: ${appUrl}/inventario?q=${encodeURIComponent(item.sku ?? item.nombre)}`,
    '',
    '— Ingeniería Biomédica ERP',
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, text }
}

/** Procesa alertas de stock mínimo. Idempotente por artículo y día. */
export async function procesarAlertasStockMinimo(): Promise<{ enviados: number; omitidos: number }> {
  if (!alertasHabilitadas()) return { enviados: 0, omitidos: 0 }

  const destinatarios = await resolverDestinatarios()
  if (destinatarios.length === 0) return { enviados: 0, omitidos: 0 }

  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const bajos = await listarArticulosStockBajo()

  let enviados = 0
  let omitidos = 0

  for (const item of bajos) {
    if (await yaEnviadoHoy(item.id)) {
      omitidos++
      continue
    }

    const { subject, text } = textoAlerta(item, appUrl)
    const ok = await sendSystemEmail({ to: destinatarios, subject, text })
    if (ok) {
      await marcarEnviado(item.id, destinatarios)
      enviados++
    } else {
      await marcarFallo(item.id, 'SMTP no disponible o error de envío')
      omitidos++
    }
  }

  return { enviados, omitidos }
}
