/**
 * Cron local: planes preventivos vencidos + emails OT SLA próximo + preventivo próximo.
 * Uso: npx tsx --env-file=.env scripts/notificaciones-operativas.ts
 */
import { actualizarPlanesMantenimientoVencidos } from '../lib/mantenimiento/actualizar-vencidos'
import { procesarEmailsOperativosInbox } from '../lib/notificaciones/procesar-emails-operativos'
import { procesarConversacionesSinRespuesta2h } from '../lib/crm/sin-respuesta-2h'

async function main() {
  const planesVencidos = await actualizarPlanesMantenimientoVencidos()
  const r = await procesarEmailsOperativosInbox()
  const crmSinRespuesta = await procesarConversacionesSinRespuesta2h()
  console.log('✅ notificaciones operativas', { planesVencidos, crmSinRespuesta, ...r })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
