/**
 * Cron local: planes preventivos vencidos + emails OT SLA próximo + preventivo próximo.
 * Uso: npx tsx --env-file=.env scripts/notificaciones-operativas.ts
 */
import { actualizarPlanesMantenimientoVencidos } from '../lib/mantenimiento/actualizar-vencidos'
import { procesarEmailsOperativosInbox } from '../lib/notificaciones/procesar-emails-operativos'

async function main() {
  const planesVencidos = await actualizarPlanesMantenimientoVencidos()
  const r = await procesarEmailsOperativosInbox()
  console.log('✅ notificaciones operativas', { planesVencidos, ...r })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
