/**
 * scripts/e2e-smoke.ts — Smoke test Prisma + módulos contabilidad/facturación
 * Ejecutar: npx tsx --env-file=.env scripts/e2e-smoke.ts
 */
import { prisma } from '../lib/prisma'
import { getResumenContabilidad, ensureContabilidadArgentina } from '../lib/contabilidad/seed-argentina'
import { ensureAlicuotasIvaDefault } from '../lib/iva/alicuotas-default'

const errors: string[] = []
const ok: string[] = []

function pass(msg: string) {
  ok.push(msg)
  console.log('✅', msg)
}
function fail(msg: string, err?: unknown) {
  const detail = err instanceof Error ? err.message : String(err ?? '')
  errors.push(`${msg}: ${detail}`)
  console.error('❌', msg, detail ? `— ${detail}` : '')
}

async function main() {
  console.log('\n=== E2E Smoke — ibiomedica ===\n')

  // 1. Prisma delegates
  const delegates = [
    'alicuotaIva',
    'configuracionContable',
    'tipoComprobanteAfip',
    'vencimientoCobranza',
    'condicionIvaCat',
    'regimenImpositivo',
    'planCuenta',
  ] as const
  for (const d of delegates) {
    const c = prisma as unknown as Record<string, unknown>
    if (c[d] && typeof (c[d] as { findMany?: unknown }).findMany === 'function') {
      pass(`Delegate prisma.${d}`)
    } else {
      fail(`Delegate prisma.${d} missing — run: npx prisma generate && restart dev server`)
    }
  }

  // 2. Factura + vencimientos include (facturación page)
  try {
    await prisma.factura.findMany({
      take: 1,
      include: {
        cliente: { select: { nombre: true } },
        vencimientos: { orderBy: { numeroCuota: 'asc' } },
      },
    })
    pass('factura.findMany({ include: { vencimientos } })')
  } catch (e) {
    fail('factura.findMany with vencimientos', e)
  }

  // 3. Seed alícuotas
  try {
    const alicuotas = await ensureAlicuotasIvaDefault()
    if (alicuotas.length >= 4) pass(`ensureAlicuotasIvaDefault (${alicuotas.length} alícuotas)`)
    else fail(`ensureAlicuotasIvaDefault — solo ${alicuotas.length} alícuotas`)
  } catch (e) {
    fail('ensureAlicuotasIvaDefault', e)
  }

  // 4. Seed contabilidad Argentina
  try {
    await ensureContabilidadArgentina()
    pass('ensureContabilidadArgentina')
  } catch (e) {
    fail('ensureContabilidadArgentina', e)
  }

  // 5. Resumen contabilidad (hub page)
  try {
    const r = await getResumenContabilidad()
    const counts = {
      alicuotas: r.alicuotas.length,
      condicionesIva: r.condicionesIva.length,
      comprobantesAfip: r.comprobantesAfip.length,
      tiposDocumento: r.tiposDocumento.length,
      planCuentas: r.planCuentas.length,
      regimenes: r.regimenes.length,
    }
    if (counts.alicuotas >= 4 && counts.comprobantesAfip >= 8) {
      pass(`getResumenContabilidad (${JSON.stringify(counts)})`)
    } else {
      fail(`getResumenContabilidad counts bajos: ${JSON.stringify(counts)}`)
    }
  } catch (e) {
    fail('getResumenContabilidad', e)
  }

  // 6. Tablas en DB
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      AND tablename IN ('alicuotas_iva', 'vencimientos_cobranza', 'tipos_comprobante_afip', 'configuracion_contable')
    `
    const names = tables.map((t) => t.tablename).sort()
    if (names.length >= 4) pass(`Tablas DB presentes: ${names.join(', ')}`)
    else fail(`Faltan tablas en DB: ${names.join(', ')} — run: npx prisma migrate deploy`)
  } catch (e) {
    fail('Verificación tablas DB', e)
  }

  // 7. Historia clínica del equipo
  try {
    const eq = await prisma.equipo.findFirst({ orderBy: { creadoEn: 'asc' } })
    if (eq) {
      const { getEquipoHistoriaCompleta, getAlertasComponentesEquipos } = await import('../lib/equipos/historia-clinica')
      const h = await getEquipoHistoriaCompleta(eq.id)
      const alertas = await getAlertasComponentesEquipos()
      if (h?.equipo?.id) pass(`getEquipoHistoriaCompleta (${h.bitacora.length} eventos bitácora)`)
      else fail('getEquipoHistoriaCompleta — sin equipo')
      pass(`getAlertasComponentesEquipos (${alertas.length} alertas)`)
    }
  } catch (e) {
    fail('Historia clínica equipos', e)
  }

  console.log('\n--- Resumen ---')
  console.log(`OK: ${ok.length} | Errores: ${errors.length}`)
  if (errors.length) {
    console.log('\nErrores:')
    errors.forEach((e) => console.log(' •', e))
    process.exit(1)
  }
  console.log('\n🎉 Smoke test OK\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
