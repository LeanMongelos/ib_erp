/**
 * Backfill de coords en mapa ST (VPS / BD existente sin seed completo).
 * Idempotente: copia fuentes existentes; demo solo donde no hay coords.
 */
import { prisma } from '../lib/prisma'
import { backfillUbicacionEquipos } from '../lib/equipos/seed-tracking-demo'

async function main() {
  const totalEquipos = await prisma.equipo.count({ where: { estado: { not: 'BAJA' } } })
  const sinCoordsAntes = await prisma.equipo.count({
    where: { ubicacionLat: null, estado: { not: 'BAJA' } },
  })

  console.log(`[sync-tracking] Equipos activos: ${totalEquipos}, sin ubicacionLat: ${sinCoordsAntes}`)

  const r = await backfillUbicacionEquipos()

  const actualizados =
    r.fromEvento + r.fromSucursal + r.fromSucursalCliente + r.fromCliente + r.demoCreados

  console.log('[sync-tracking] Resultado:', JSON.stringify(r))

  const sinCoordsDespues = await prisma.equipo.count({
    where: { ubicacionLat: null, estado: { not: 'BAJA' } },
  })
  console.log(`[sync-tracking] Equipos geolocalizados: ${actualizados}, aún sin coords: ${sinCoordsDespues}`)

  if (totalEquipos > 0 && actualizados === 0 && sinCoordsDespues === totalEquipos) {
    console.warn(
      '[sync-tracking] ADVERTENCIA: hay equipos pero ninguno tiene coords ni fuentes (cliente/sucursal/evento)',
    )
  }
}

main()
  .catch((e) => {
    console.error('[sync-tracking] ERROR:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
