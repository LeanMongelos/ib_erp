/**
 * Envía resumen semanal admin (dedup semanal).
 * Uso: npx tsx --env-file=.env scripts/resumen-semanal.ts
 */
import { procesarResumenSemanalAdmin } from '../lib/admin/resumen-semanal'

async function main() {
  const r = await procesarResumenSemanalAdmin()
  if (r.omitido) {
    console.log(`Resumen semanal omitido: ${r.motivo ?? 'desconocido'}`)
  } else if (r.enviado) {
    console.log('Resumen semanal enviado.', r.kpis)
  } else {
    console.log('Resumen semanal no enviado.', r)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
