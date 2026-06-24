/**
 * Asigna plantillaId a facturas/presupuestos que quedaron sin snapshot.
 * Usa la predeterminada vigente del tipo (no reescribe plantillaId existente).
 *
 * Uso: npx tsx --env-file=.env scripts/backfill-plantillas-documentos.ts --execute
 */
import { prisma } from '../lib/prisma'
import { resolverPlantillaIdEmision } from '../lib/plantillas/resolver-plantilla'

const MARCA = 'BACKFILL_PLANTILLAS_DOCUMENTOS'

async function yaSeEjecuto(): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: { mensaje: { contains: MARCA } },
    select: { id: true },
  })
  return Boolean(prev)
}

async function backfillTabla(
  tabla: 'factura' | 'presupuesto',
  tipo: 'FACTURA' | 'PRESUPUESTO',
): Promise<number> {
  const plantillaId = await resolverPlantillaIdEmision(tipo, null)
  if (!plantillaId) {
    console.log(`[backfill-plantillas] Sin predeterminada ${tipo}; omitiendo ${tabla}.`)
    return 0
  }

  if (tabla === 'factura') {
    const r = await prisma.factura.updateMany({
      where: { plantillaId: null },
      data: { plantillaId },
    })
    return r.count
  }

  const r = await prisma.presupuesto.updateMany({
    where: { plantillaId: null },
    data: { plantillaId },
  })
  return r.count
}

async function main() {
  const execute = process.argv.includes('--execute')
  const force = process.argv.includes('--force')

  const sinFactura = await prisma.factura.count({ where: { plantillaId: null } })
  const sinPresupuesto = await prisma.presupuesto.count({ where: { plantillaId: null } })

  console.log(`[backfill-plantillas] Sin plantillaId: facturas=${sinFactura}, presupuestos=${sinPresupuesto}`)

  if (!execute) {
    console.log('[backfill-plantillas] Dry-run. Usá --execute para aplicar.')
    return
  }

  if (!force && (await yaSeEjecuto()) && sinFactura === 0 && sinPresupuesto === 0) {
    console.log('[backfill-plantillas] Ya ejecutado y no hay pendientes (--force para repetir).')
    return
  }

  const facturas = await backfillTabla('factura', 'FACTURA')
  const presupuestos = await backfillTabla('presupuesto', 'PRESUPUESTO')

  await prisma.systemLog.create({
    data: {
      nivel: 'INFO',
      origen: 'backfill-plantillas-documentos',
      mensaje: `${MARCA}: facturas=${facturas}, presupuestos=${presupuestos}`,
      metadata: { facturas, presupuestos },
    },
  })

  console.log(`[backfill-plantillas] Actualizados: ${facturas} factura(s), ${presupuestos} presupuesto(s).`)
}

main()
  .catch((e) => {
    console.error('[backfill-plantillas] ERROR:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
