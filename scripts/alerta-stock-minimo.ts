/**
 * Envía alertas de stock mínimo a admin (dedup diaria por artículo).
 * Idempotente — seguro para cron VPS o POST /api/cron/stock-minimo.
 *
 * Uso: npx tsx --env-file=.env scripts/alerta-stock-minimo.ts
 */
import { procesarAlertasStockMinimo } from '../lib/inventario/alerta-stock-minimo'

async function main() {
  const r = await procesarAlertasStockMinimo()
  console.log(`Alertas stock mínimo — enviados: ${r.enviados}, omitidos: ${r.omitidos}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
