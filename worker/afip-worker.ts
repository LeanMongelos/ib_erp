/**
 * worker/afip-worker.ts
 * Worker BullMQ para emisión AFIP asíncrona.
 * Si Redis no está disponible, queda en modo stub (emisión vía API síncrona).
 */

import { procesarEmisionFactura } from '@/lib/afip/emitir'

const REDIS_URL = process.env.REDIS_URL

function parseRedisUrl(url: string) {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    maxRetriesPerRequest: null as null,
  }
}

async function runWorker() {
  if (!REDIS_URL) {
    console.log('[afip-worker] REDIS_URL no configurado — modo stub (sync fallback)')
    console.log('[afip-worker] Para emitir, usá POST /api/facturas/[id]/emitir')
    return
  }

  try {
    const { Worker } = await import('bullmq')
    const connection = parseRedisUrl(REDIS_URL)

    new Worker(
      'afip-emision',
      async (job) => {
        const { facturaId, usuarioId } = job.data as { facturaId: string; usuarioId?: string }
        console.log(`[afip-worker] Procesando factura ${facturaId}`)
        const result = await procesarEmisionFactura(facturaId, usuarioId)
        if (!result.ok) throw new Error(result.observaciones ?? 'Rechazada')
        return result
      },
      { connection },
    )

    console.log('[afip-worker] Escuchando cola afip-emision…')
  } catch (err) {
    console.error('[afip-worker] Error al iniciar BullMQ:', err)
    console.log('[afip-worker] Fallback: emisión síncrona vía API')
  }
}

runWorker().catch(console.error)

export async function encolarEmisionFactura(facturaId: string, usuarioId?: string) {
  if (!REDIS_URL) {
    return procesarEmisionFactura(facturaId, usuarioId)
  }
  try {
    const { Queue } = await import('bullmq')
    const connection = parseRedisUrl(REDIS_URL)
    const queue = new Queue('afip-emision', { connection })
    await queue.add('emitir', { facturaId, usuarioId })
    return { ok: true, encolado: true }
  } catch {
    return procesarEmisionFactura(facturaId, usuarioId)
  }
}
