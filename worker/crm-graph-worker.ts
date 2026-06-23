/**
 * worker/crm-graph-worker.ts
 * Poll Microsoft Graph Mail cada 2 minutos.
 */

import { pollGraphInbox } from '@/lib/crm/adapters/email-graph'
import { registrarErrorDesdeExcepcion } from '@/lib/error-log'

const INTERVAL_MS = Number(process.env.CRM_GRAPH_POLL_MS ?? 120_000)

async function tick() {
  try {
    const n = await pollGraphInbox()
    if (n > 0) console.log(`[crm-graph-worker] ${n} mail(s) procesados`)
  } catch (err) {
    console.error('[crm-graph-worker]', err instanceof Error ? err.message : err)
    await registrarErrorDesdeExcepcion('worker-crm', err, { metadata: { worker: 'crm-graph' } })
  }
}

async function main() {
  console.log(`[crm-graph-worker] Iniciando poll cada ${INTERVAL_MS / 1000}s…`)
  await tick()
  setInterval(tick, INTERVAL_MS)
}

main().catch(console.error)
