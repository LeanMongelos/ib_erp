/**
 * Cron local: emails OT SLA próximo + preventivo próximo.
 * Uso: npx tsx --env-file=.env scripts/notificaciones-operativas.ts
 */
import { procesarEmailsOperativosInbox } from '../lib/notificaciones/procesar-emails-operativos'

async function main() {
  const r = await procesarEmailsOperativosInbox()
  console.log('✅ notificaciones operativas', r)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
