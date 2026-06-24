/**
 * Checklist unificado pre go-live / primera factura real.
 * Uso: npm run go-live:check
 * En VPS: cd /opt/ibiomedica && npm run go-live:check
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { prisma } from '../lib/prisma'
import { obtenerGoLiveStatus, type GoLiveItem } from '../lib/admin/go-live-status'

type Nivel = 'pass' | 'warn' | 'fail'

function tag(nivel: Nivel): string {
  if (nivel === 'pass') return 'PASS'
  if (nivel === 'warn') return 'WARN'
  return 'FAIL'
}

function printItem(item: GoLiveItem) {
  const icon = item.nivel === 'pass' ? '✅' : item.nivel === 'warn' ? '⚠️ ' : '❌'
  console.log(`${icon} [${tag(item.nivel)}] ${item.msg}`)
}

function checkIntegridad(items: GoLiveItem[]) {
  console.log('\n--- 3. Integridad de datos ---\n')

  const script = path.join(process.cwd(), 'scripts', 'integridad-prod.ts')
  const result = spawnSync('npx', ['tsx', '--env-file=.env', script], {
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32',
  })

  const output = (result.stdout ?? '') + (result.stderr ?? '')
  if (output.trim()) {
    process.stdout.write(output)
    if (!output.endsWith('\n')) console.log('')
  }

  if (result.status === 0) {
    items.push({
      seccion: 'integridad',
      nivel: 'pass',
      msg: 'Integridad de datos: sin errores bloqueantes',
    })
    printItem(items[items.length - 1])
  } else {
    items.push({
      seccion: 'integridad',
      nivel: 'fail',
      msg: 'Integridad de datos: hay errores — revisar salida anterior',
    })
    printItem(items[items.length - 1])
  }
}

function printResumen(items: GoLiveItem[]) {
  const pass = items.filter((i) => i.nivel === 'pass').length
  const warn = items.filter((i) => i.nivel === 'warn').length
  const fail = items.filter((i) => i.nivel === 'fail').length

  console.log('\n=== Resumen checklist go-live ===')
  console.log(`PASS: ${pass} | WARN: ${warn} | FAIL: ${fail}`)

  if (fail > 0) {
    console.log('\n❌ NO LISTO para primera factura real — corregir FAIL antes de emitir.')
    console.log('   Revisar: emisores PRODUCCION, certificados, ADMIN_NOTIFY_EMAIL, SMTP y worker AFIP.\n')
    process.exit(1)
  }
  if (warn > 0) {
    console.log('\n⚠️  Listo con advertencias — revisar WARN antes del primer comprobante fiscal.')
    console.log('   Recomendado: ADMIN_NOTIFY_EMAIL explícito, smoke AFIP y npm run post-go-live:smoke en el VPS.\n')
  } else {
    console.log('\n✅ Checklist OK — puede proceder con homologación o producción según ambiente.')
    console.log('   Siguiente paso sugerido: npm run post-go-live:smoke\n')
  }
}

async function main() {
  console.log('\n=== Checklist go-live iBiomédica ===')
  console.log(`Fecha: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}\n`)

  process.env.FORCE_PROD = '1'
  const status = await obtenerGoLiveStatus()

  console.log('\n--- 1. Entorno (.env) ---\n')
  for (const item of status.items.filter((i) => i.seccion === 'entorno')) printItem(item)

  console.log('\n--- 2. Emisores AFIP (BD) ---\n')
  for (const item of status.items.filter((i) => i.seccion === 'emisores')) printItem(item)

  console.log('\n--- 2b. Worker AFIP ---\n')
  for (const item of status.items.filter((i) => i.seccion === 'worker')) printItem(item)

  console.log('\n--- 2c. Worker cobranzas ---\n')
  for (const item of status.items.filter((i) => i.seccion === 'worker_cobranzas')) printItem(item)

  console.log('\n--- 2d. Alertas AFIP / correo ---\n')
  for (const item of status.items.filter((i) => i.seccion === 'alertas')) printItem(item)

  const allItems = [...status.items]
  checkIntegridad(allItems)
  printResumen(allItems)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
