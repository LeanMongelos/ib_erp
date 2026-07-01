/**
 * Export JSON para equipo ML (sin datos sensibles).
 * Uso: npm run export:ml-handoff
 *
 * La forma de datos (schemaVersion 2) es la misma que expone la API de lectura
 * `/api/ml/*`; ambos reutilizan `lib/ml/handoff.ts` (fuente única, sin duplicar).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { HANDOFF_CLIENTES } from '../lib/equipos/seed-ml-handoff'
import { getClientesHandoffMl, getOtrosClientesMl } from '../lib/ml/handoff'

const OUTPUT = path.join(process.cwd(), 'docs', 'exports', 'ml-handoff-clientes-equipos.json')

async function main() {
  const clientes = await getClientesHandoffMl()
  const otrosClientes = await getOtrosClientesMl()

  const payload = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 2,
    clientes,
    otrosClientes,
  }

  await mkdir(path.dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, JSON.stringify(payload, null, 2) + '\n', 'utf8')

  const encontrados = new Set(clientes.map((c) => c.nombre))
  const faltantes = HANDOFF_CLIENTES.filter((n) => !encontrados.has(n))

  console.log(`✅ Export ML handoff → ${OUTPUT}`)
  console.log(`   Clientes handoff: ${clientes.length}/${HANDOFF_CLIENTES.length}`)
  console.log(`   Equipos totales handoff: ${clientes.reduce((n, c) => n + c.equipos.length, 0)}`)
  console.log(
    `   Asignaciones en export: ${clientes.reduce(
      (n, c) => n + c.equipos.reduce((m, e) => m + e.asignaciones.length, 0),
      0,
    )}`,
  )
  console.log(`   Otros clientes (resumen): ${otrosClientes.length}`)
  if (faltantes.length) {
    console.warn(`   ⚠️  Faltan en BD: ${faltantes.join(', ')} (ejecute npm run db:seed)`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Error export ML handoff:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
