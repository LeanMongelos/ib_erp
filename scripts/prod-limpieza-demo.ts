/**
 * Limpieza de datos demo en producción (go-live).
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/prod-limpieza-demo.ts
 *   npx tsx --env-file=.env scripts/prod-limpieza-demo.ts --force
 */
import { limpiarDatosDemo, yaSeLimpioDemo } from '../lib/prod/limpieza-demo'
import { prisma } from '../lib/prisma'

async function main() {
  const force = process.argv.includes('--force')

  if (!force && (await yaSeLimpioDemo())) {
    console.log('[limpieza-demo] Ya se ejecutó antes; omitiendo (usá --force para repetir).')
    return
  }

  console.log('[limpieza-demo] Borrando datos transaccionales de ejemplo…')
  const counts = await limpiarDatosDemo()
  console.log('[limpieza-demo] Listo:', counts)
}

main()
  .catch((e) => {
    console.error('[limpieza-demo] ERROR:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
