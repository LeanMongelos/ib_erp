/**
 * Genera cuotas mensuales de alquiler y marca vencidas.
 * Idempotente — seguro para cron VPS o POST /api/cron/alquiler-cuotas.
 *
 * Uso: npm run cron:alquiler-cuotas
 */
import { procesarCuotasAlquilerDelDia } from '../lib/alquiler/procesar-cuotas-alquiler'

async function main() {
  const result = await procesarCuotasAlquilerDelDia()
  console.log(
    `Alquiler cuotas — período ${result.periodo}: ${result.creadas} creada(s), ` +
      `${result.cuotasMarcadasVencidas} marcada(s) VENCIDA`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
