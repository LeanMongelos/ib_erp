/**
 * Validación de entorno de producción (vars + emisores AFIP en BD).
 * Uso: npm run validar:env-prod
 * En VPS deploy: FORCE_PROD=1 npm run validar:env-prod
 */
import { prisma } from '../lib/prisma'
import { validarEnvProd, type EnvCheck } from '../lib/env/validar-prod'
import { emisorTieneCertificados } from '../lib/afip/validar-emision'

function printCheck(c: EnvCheck) {
  const icon = c.nivel === 'ok' ? '✅' : c.nivel === 'warn' ? '⚠️ ' : '❌'
  const fn = c.nivel === 'error' ? console.error : c.nivel === 'warn' ? console.warn : console.log
  fn(`${icon} ${c.msg}`)
}

async function validarEmisoresAfip(): Promise<EnvCheck[]> {
  const checks: EnvCheck[] = []
  const emisores = await prisma.emisor.findMany({
    where: { activo: true },
    select: {
      razonSocial: true,
      ambiente: true,
      certificadoPath: true,
      clavePrivadaPath: true,
    },
  })

  const prod = emisores.filter((e) => e.ambiente === 'PRODUCCION')
  const homo = emisores.filter((e) => e.ambiente === 'HOMOLOGACION')

  if (prod.length === 0) {
    checks.push({
      nivel: 'ok',
      msg: `AFIP: sin emisor activo en PRODUCCION (${homo.length} en homologación)`,
    })
    return checks
  }

  const sinCert = prod.filter((e) => !emisorTieneCertificados(e))
  if (sinCert.length === 0) {
    checks.push({
      nivel: 'ok',
      msg: `AFIP: ${prod.length} emisor(es) PRODUCCION con certificados configurados`,
    })
  } else {
    checks.push({
      nivel: 'error',
      msg: `AFIP PRODUCCION sin certificados: ${sinCert.map((e) => e.razonSocial).join(', ')}`,
    })
  }

  return checks
}

async function main() {
  console.log('\n=== Validación entorno producción ===\n')

  const envResult = validarEnvProd(process.env)
  for (const c of envResult.checks) printCheck(c)

  let dbErrores = 0
  try {
    const afipChecks = await validarEmisoresAfip()
    for (const c of afipChecks) {
      printCheck(c)
      if (c.nivel === 'error') dbErrores++
    }
  } catch (e) {
    console.warn('⚠️  No se pudo validar emisores AFIP en BD:', (e as Error).message)
  }

  const totalErrores = envResult.errores + dbErrores
  const totalWarns = envResult.advertencias

  console.log(`\n--- ${totalErrores} error(es) | ${totalWarns} advertencia(s) ---\n`)

  if (totalErrores > 0) {
    process.exit(1)
  }
  console.log('Validación OK\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
