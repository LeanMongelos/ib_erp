/**
 * lib/afip/queue.ts — cola BullMQ para emisión AFIP con reintentos.
 */

import { Queue } from 'bullmq'

const QUEUE_NAME = 'afip-emision'

function getConnection() {
  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
  return { url }
}

let queue: Queue | null = null

export function getAfipQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    })
  }
  return queue
}

export async function encolarEmisionFactura(facturaId: string, usuarioId?: string) {
  const q = getAfipQueue()
  await q.add('emitir', { facturaId, usuarioId }, { jobId: `factura-${facturaId}` })
}

export { QUEUE_NAME }
