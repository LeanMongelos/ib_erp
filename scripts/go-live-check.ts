/**
 * Checklist unificado pre go-live / primera factura real.
 * Uso: npm run go-live:check
 * En VPS: cd /opt/ibiomedica && npm run go-live:check
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { prisma } from '../lib/prisma'
import { validarEnvProd, type EnvCheck } from '../lib/env/validar-prod'
import {
  emisorTieneCertificados,
  estadoPreparacionAfip,
} from '../lib/afip/validar-emision'

type Nivel = 'pass' | 'warn' | 'fail'
type Item = { nivel: Nivel; msg: string; seccion: string }

const items: Item[] = []

function tag(nivel: Nivel): string {
  if (nivel === 'pass') return 'PASS'
  if (nivel === 'warn') return 'WARN'
  return 'FAIL'
}

function add(seccion: string, nivel: Nivel, msg: string) {
  items.push({ seccion, nivel, msg })
  const icon = nivel === 'pass' ? '✅' : nivel === 'warn' ? '⚠️ ' : '❌'
  console.log(`${icon} [${tag(nivel)}] ${msg}`)
}

function addEnvCheck(seccion: string, c: EnvCheck) {
  const nivel: Nivel = c.nivel === 'ok' ? 'pass' : c.nivel === 'warn' ? 'warn' : 'fail'
  add(seccion, nivel, c.msg)
}

async function checkEntorno() {
  console.log('\n--- 1. Entorno (.env) ---\n')
  process.env.FORCE_PROD = '1'
  const result = validarEnvProd(process.env)
  for (const c of result.checks) addEnvCheck('entorno', c)
}

async function checkEmisores() {
  console.log('\n--- 2. Emisores AFIP (BD) ---\n')

  const emisores = await prisma.emisor.findMany({
    where: { activo: true },
    select: {
      razonSocial: true,
      ambiente: true,
      certificadoPath: true,
      clavePrivadaPath: true,
      predeterminado: true,
      puntoVenta: true,
    },
    orderBy: [{ predeterminado: 'desc' }, { razonSocial: 'asc' }],
  })

  if (emisores.length === 0) {
    add('emisores', 'fail', 'Sin emisores activos — crear uno en Configuración → Emisores')
    return
  }

  add('emisores', 'pass', `${emisores.length} emisor(es) activo(s) en BD`)

  for (const e of emisores) {
    const prep = estadoPreparacionAfip(e)
    const pred = e.predeterminado ? ' [predeterminado]' : ''
    const base = `${e.razonSocial}${pred}: ${e.ambiente}, PtoVta ${e.puntoVenta}`

    switch (prep) {
      case 'listo_produccion':
        add('emisores', 'pass', `${base} — certificados OK, listo para facturar`)
        break
      case 'listo_cambiar_a_produccion':
        add(
          'emisores',
          'warn',
          `${base} — certificados cargados; puede cambiar a PRODUCCION cuando AFIP autorice`,
        )
        break
      case 'produccion_sin_certificados':
        add(
          'emisores',
          'fail',
          `${base} — PRODUCCION sin certificado/clave; bloquea emisión fiscal`,
        )
        break
      case 'homologacion_sin_cert':
        add('emisores', 'warn', `${base} — homologación sin cert (CAE simulado permitido)`)
        break
    }
  }

  const prodSinCert = emisores.filter(
    (e) => e.ambiente === 'PRODUCCION' && !emisorTieneCertificados(e),
  )
  if (prodSinCert.length > 0) {
    add(
      'emisores',
      'fail',
      `Resumen: ${prodSinCert.length} emisor(es) PRODUCCION sin certificados`,
    )
  } else if (emisores.some((e) => e.ambiente === 'PRODUCCION')) {
    add('emisores', 'pass', 'Todos los emisores PRODUCCION tienen certificados')
  }
}

function checkIntegridad() {
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
    add('integridad', 'pass', 'Integridad de datos: sin errores bloqueantes')
  } else {
    add('integridad', 'fail', 'Integridad de datos: hay errores — revisar salida anterior')
  }
}

function printResumen() {
  const pass = items.filter((i) => i.nivel === 'pass').length
  const warn = items.filter((i) => i.nivel === 'warn').length
  const fail = items.filter((i) => i.nivel === 'fail').length

  console.log('\n=== Resumen checklist go-live ===')
  console.log(`PASS: ${pass} | WARN: ${warn} | FAIL: ${fail}`)

  if (fail > 0) {
    console.log('\n❌ NO LISTO para primera factura real — corregir FAIL antes de emitir.\n')
    process.exit(1)
  }
  if (warn > 0) {
    console.log('\n⚠️  Listo con advertencias — revisar WARN antes del primer comprobante fiscal.\n')
  } else {
    console.log('\n✅ Checklist OK — puede proceder con homologación o producción según ambiente.\n')
  }
}

async function main() {
  console.log('\n=== Checklist go-live iBiomédica ===')
  console.log(`Fecha: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}\n`)

  await checkEntorno()
  await checkEmisores()
  checkIntegridad()
  printResumen()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
