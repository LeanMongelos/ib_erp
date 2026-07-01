import { prisma } from '@/lib/prisma'
import { backfillAsignacionesDesdeEquipos } from '@/lib/equipos/asignaciones'

async function main() {
  const count = await backfillAsignacionesDesdeEquipos()
  console.log(`✅ Backfill asignaciones: ${count} equipos`)
}

main()
  .catch((e) => {
    console.error('❌', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
