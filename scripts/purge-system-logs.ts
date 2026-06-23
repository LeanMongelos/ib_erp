/**
 * Elimina logs del sistema con más de 15 días.
 * Uso: npm run logs:purge
 * También puede programarse en cron diario en el VPS.
 */

import { limpiarLogsAntiguos, LOG_RETENTION_DAYS } from '../lib/error-log'
import { prisma } from '../lib/prisma'

async function main() {
  const n = await limpiarLogsAntiguos()
  console.log(`✅ ${n} log(s) eliminado(s) (retención: ${LOG_RETENTION_DAYS} días)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
