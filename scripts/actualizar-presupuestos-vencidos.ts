/**
 * Marca presupuestos ENVIADO/APROBADO con fechaVencimiento pasada como VENCIDO.
 * Idempotente — seguro para cron VPS o POST /api/cron/presupuestos-vencidos.
 *
 * Uso: npx tsx --env-file=.env scripts/actualizar-presupuestos-vencidos.ts
 */
import { actualizarPresupuestosVencidos } from '../lib/presupuestos/actualizar-vencidos'

async function main() {
  const n = await actualizarPresupuestosVencidos()
  console.log(`Presupuestos marcados VENCIDO: ${n}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
