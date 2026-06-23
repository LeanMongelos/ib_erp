/**
 * Backfill de coords demo en mapa ST (VPS / BD existente sin seed completo).
 * Idempotente: solo equipos sin ubicacionLat ni eventos de tracking.
 */
import { prisma } from '../lib/prisma'
import { seedTrackingDemo } from '../lib/equipos/seed-tracking-demo'

async function main() {
  const count = await seedTrackingDemo()
  if (count === 0) {
    console.log('ℹ️ No hay equipos pendientes de geolocalización demo')
  } else {
    console.log(`✅ Tracking demo aplicado a ${count} equipos`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
