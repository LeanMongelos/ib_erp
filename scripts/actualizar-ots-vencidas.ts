/**
 * Marca OTs ABIERTA/EN_PROCESO con SLA vencido como VENCIDA.
 * Idempotente — seguro para cron VPS o POST /api/cron/ots-vencidas.
 *
 * Uso: npx tsx --env-file=.env scripts/actualizar-ots-vencidas.ts
 */
import { actualizarOTsVencidas } from '../lib/ots'

async function main() {
  const n = await actualizarOTsVencidas()
  console.log(`OTs marcadas VENCIDA: ${n}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
