/**
 * worker/crm-email-worker.ts
 * Poll IMAP cada 2 minutos para ingestar correos al CRM.
 */

import { pollImapInbox } from '@/lib/crm/adapters/email-imap'

const INTERVAL_MS = Number(process.env.CRM_EMAIL_POLL_MS ?? 120_000)

async function tick() {
  try {
    const n = await pollImapInbox()
    if (n > 0) console.log(`[crm-email-worker] ${n} mail(s) procesados`)
  } catch (err) {
    console.error('[crm-email-worker]', err instanceof Error ? err.message : err)
  }
}

async function main() {
  console.log(`[crm-email-worker] Iniciando poll cada ${INTERVAL_MS / 1000}s…`)
  await tick()
  setInterval(tick, INTERVAL_MS)
}

main().catch(console.error)
