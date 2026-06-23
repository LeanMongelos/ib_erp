/**
 * Sincroniza listas MIN-ARS / MAY-ARS en VPS (idempotente, upsert).
 */
import { prisma } from '../lib/prisma'
import { seedListasPrecios } from '../lib/precios/seed-listas-precios'

async function main() {
  const result = await seedListasPrecios(prisma)
  console.log(`[sync-listas] MIN-ARS + MAY-ARS: ${result.items} ítems de lista actualizados/creados`)
}

main()
  .catch((e) => {
    console.error('[sync-listas] Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
