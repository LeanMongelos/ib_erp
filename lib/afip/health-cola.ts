/**
 * Salud de la cola BullMQ AFIP — usado en integridad post-deploy.
 */
import { prisma } from '@/lib/prisma'
import { QUEUE_NAME } from '@/lib/afip/queue'

const STALE_MINUTES = 30

function parseRedisUrl(url: string) {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    maxRetriesPerRequest: null as null,
  }
}

export type SaludColaAfip = {
  redisConfigurado: boolean
  pendientesCae: number
  pendientesCaeAntiguas: number
  colaWaiting: number | null
  colaActive: number | null
  colaFailed: number | null
  colaError: string | null
}

export async function evaluarSaludColaAfip(): Promise<SaludColaAfip> {
  const redisUrl = process.env.REDIS_URL
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000)

  const [pendientesCae, pendientesCaeAntiguas] = await Promise.all([
    prisma.factura.count({ where: { estado: 'PENDIENTE_CAE' } }),
    prisma.factura.count({
      where: { estado: 'PENDIENTE_CAE', creadoEn: { lt: cutoff } },
    }),
  ])

  if (!redisUrl) {
    return {
      redisConfigurado: false,
      pendientesCae,
      pendientesCaeAntiguas,
      colaWaiting: null,
      colaActive: null,
      colaFailed: null,
      colaError: null,
    }
  }

  try {
    const { Queue } = await import('bullmq')
    const connection = parseRedisUrl(redisUrl)
    const queue = new Queue(QUEUE_NAME, { connection })
    const [colaWaiting, colaActive, colaFailed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
    ])
    await queue.close()
    return {
      redisConfigurado: true,
      pendientesCae,
      pendientesCaeAntiguas,
      colaWaiting,
      colaActive,
      colaFailed,
      colaError: null,
    }
  } catch (err) {
    return {
      redisConfigurado: true,
      pendientesCae,
      pendientesCaeAntiguas,
      colaWaiting: null,
      colaActive: null,
      colaFailed: null,
      colaError: err instanceof Error ? err.message : String(err),
    }
  }
}
