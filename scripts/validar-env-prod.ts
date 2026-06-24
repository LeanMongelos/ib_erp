/**
 * Validación de entorno de producción (vars + emisores AFIP en BD).
 * Uso: npm run validar:env-prod
 * En VPS deploy: FORCE_PROD=1 npm run validar:env-prod
 */
import { prisma } from '../lib/prisma'
import { validarEnvProd, type EnvCheck } from '../lib/env/validar-prod'
import {
  smtpEnvConfigurado,
  validarAlertasEnvProd,
} from '../lib/env/alertas-prod'
import { emisorTieneCertificados } from '../lib/afip/validar-emision'
import { getAdminNotifyEmails } from '../lib/mail/system-mail'

function printCheck(c: EnvCheck) {
  const icon = c.nivel === 'ok' ? '✅' : c.nivel === 'warn' ? '⚠️ ' : '❌'
  const fn = c.nivel === 'error' ? console.error : c.nivel === 'warn' ? console.warn : console.log
  fn(`${icon} ${c.msg}`)
}

async function validarEmisoresAfip(): Promise<{ checks: EnvCheck[]; hayProduccion: boolean }> {
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
    return { checks, hayProduccion: false }
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

  return { checks, hayProduccion: true }
}

async function validarAlertasProduccion(hayEmisorProduccion: boolean): Promise<{
  checks: EnvCheck[]
  errores: number
  advertencias: number
}> {
  const checks = validarAlertasEnvProd(process.env, { hayEmisorProduccion })
  if (!hayEmisorProduccion) {
    return { checks, errores: 0, advertencias: checks.filter((c) => c.nivel === 'warn').length }
  }

  const recipients = await getAdminNotifyEmails()
  if (recipients.length === 0) {
    checks.push({
      nivel: 'error',
      msg: 'Alertas AFIP: sin destinatarios (ADMIN_NOTIFY_EMAIL ni SUPERADMIN/GERENTE activos)',
    })
  }

  if (!smtpEnvConfigurado(process.env)) {
    const canal = await prisma.canalIntegracion.findUnique({ where: { tipo: 'EMAIL_IMAP' } })
    if (!(canal?.activo && canal.estado === 'CONECTADO')) {
      checks.push({
        nivel: 'error',
        msg: 'Alertas AFIP: sin SYSTEM_SMTP_* ni canal EMAIL_IMAP conectado — correos no se enviarán',
      })
    } else {
      checks.push({ nivel: 'ok', msg: 'Alertas AFIP: canal EMAIL_IMAP conectado (fallback SMTP)' })
    }
  }

  return {
    checks,
    errores: checks.filter((c) => c.nivel === 'error').length,
    advertencias: checks.filter((c) => c.nivel === 'warn').length,
  }
}

async function main() {
  console.log('\n=== Validación entorno producción ===\n')

  const envResult = validarEnvProd(process.env)
  for (const c of envResult.checks) printCheck(c)

  let dbErrores = 0
  let dbWarns = 0
  try {
    const { checks: afipChecks, hayProduccion } = await validarEmisoresAfip()
    for (const c of afipChecks) {
      printCheck(c)
      if (c.nivel === 'error') dbErrores++
    }

    console.log('\n--- Alertas AFIP / correo ---\n')
    const alertas = await validarAlertasProduccion(hayProduccion)
    for (const c of alertas.checks) {
      printCheck(c)
    }
    dbErrores += alertas.errores
    dbWarns += alertas.advertencias
  } catch (e) {
    console.warn('⚠️  No se pudo validar emisores AFIP en BD:', (e as Error).message)
  }

  const totalErrores = envResult.errores + dbErrores
  const totalWarns = envResult.advertencias + dbWarns

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
