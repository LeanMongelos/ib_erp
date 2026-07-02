/**
 * Migra las plantillas de fábrica (Factura/Presupuesto/Remito) guardadas en BD
 * al motor HTML dedicado: quita el layout de bloques legacy y el snapshot HTML,
 * de modo que rendericen desde el archivo fuente (`html-*.html`, única fuente de
 * verdad, se actualiza solo con cada deploy).
 *
 * - Idempotente: una plantilla ya migrada (sin layout) se saltea.
 * - Seguro: solo migra plantillas cuyo layout es EXACTAMENTE el de fábrica
 *   (`LAYOUT_PRESUPUESTO_IB`); si el usuario personalizó el layout, NO se toca.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/sync-plantillas-html.ts            # dry-run
 *   npx tsx --env-file=.env scripts/sync-plantillas-html.ts --execute  # aplica
 */
import { prisma } from '../lib/prisma'
import { LAYOUT_PRESUPUESTO_IB } from '../lib/plantillas/layout-default-presupuesto'
import type { PlantillaConfig } from '../lib/plantillas/types'

const TIPOS = ['FACTURA', 'PRESUPUESTO', 'REMITO'] as const
const EXECUTE = process.argv.includes('--execute')

const layoutFabricaJson = JSON.stringify(LAYOUT_PRESUPUESTO_IB.elementos)

function esLayoutDeFabrica(config: PlantillaConfig): boolean {
  const el = config.layout?.elementos
  if (!el?.length) return false
  return JSON.stringify(el) === layoutFabricaJson
}

async function main() {
  console.log(`\n=== Sync plantillas → HTML ${EXECUTE ? '(EXECUTE)' : '(dry-run)'} ===\n`)
  let migradas = 0
  let personalizadas = 0
  let yaOk = 0

  for (const tipo of TIPOS) {
    const rows = await prisma.plantillaImpresion.findMany({ where: { tipo, activo: true } })
    for (const row of rows) {
      const config = row.config as unknown as PlantillaConfig
      const tieneLayout = Boolean(config.layout?.elementos?.length)

      if (!tieneLayout) {
        yaOk++
        console.log(`  ✓ ${tipo} «${row.nombre}» ya usa HTML (sin layout)`)
        continue
      }
      if (!esLayoutDeFabrica(config)) {
        personalizadas++
        console.warn(`  ⚠️  ${tipo} «${row.nombre}» tiene layout PERSONALIZADO — no se toca`)
        continue
      }

      // Migrable: quitar layout de fábrica + snapshot HTML → renderiza desde el archivo.
      const { layout: _layout, html: _html, ...resto } = config
      if (EXECUTE) {
        await prisma.plantillaImpresion.update({
          where: { id: row.id },
          data: { config: resto as object, version: { increment: 1 } },
        })
        console.log(`  → ${tipo} «${row.nombre}» migrada a HTML`)
      } else {
        console.log(`  → ${tipo} «${row.nombre}» se migraría a HTML (usar --execute)`)
      }
      migradas++
    }
  }

  console.log(
    `\nResumen: ${migradas} ${EXECUTE ? 'migradas' : 'a migrar'} · ${yaOk} ya OK · ${personalizadas} personalizadas (intactas)\n`,
  )
}

main()
  .catch((e) => {
    console.error('❌ Error sync plantillas:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
