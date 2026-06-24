/**
 * Tests puros — guardas pre-emisión AFIP (homologación vs producción).
 * Uso: npx tsx scripts/test-validar-emision-afip.ts
 */
import {
  emisorTieneCertificados,
  esAmbienteProduccion,
  estadoPreparacionAfip,
  validarEmisionAfip,
} from '../lib/afip/validar-emision'
import { validarEnvProd } from '../lib/env/validar-prod'
import {
  adminNotifyEmailDefinido,
  smtpEnvConfigurado,
  validarAlertasEnvProd,
} from '../lib/env/alertas-prod'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test validación emisión AFIP ===\n')

  const homo = { ambiente: 'HOMOLOGACION' as const, certificadoPath: null, clavePrivadaPath: null }
  const prodSinCert = { ambiente: 'PRODUCCION' as const, certificadoPath: null, clavePrivadaPath: null }
  const prodConCert = {
    ambiente: 'PRODUCCION' as const,
    certificadoPath: 'emisores/cert.crt',
    clavePrivadaPath: 'emisores/key.key',
  }

  if (esAmbienteProduccion(homo)) fail('homo no es producción')
  else pass('esAmbienteProduccion: HOMOLOGACION')

  if (!esAmbienteProduccion(prodConCert)) fail('prod debe ser producción')
  else pass('esAmbienteProduccion: PRODUCCION')

  if (emisorTieneCertificados(prodConCert)) pass('certificados completos')
  else fail('certificados completos')

  if (emisorTieneCertificados(homo)) fail('homo sin cert no debe pasar')
  else pass('homo sin cert: false')

  if (validarEmisionAfip(homo) !== null) fail('homo sin cert debe permitir emisión (CAE simulado)')
  else pass('homo sin cert: emisión permitida')

  if (validarEmisionAfip(prodSinCert) === null) fail('prod sin cert debe bloquear')
  else pass(`prod sin cert bloqueado: ${validarEmisionAfip(prodSinCert)!.slice(0, 40)}…`)

  if (validarEmisionAfip(prodConCert) !== null) fail('prod con cert debe permitir')
  else pass('prod con cert: emisión permitida')

  if (validarEmisionAfip(null) === null) fail('sin emisor debe fallar')
  else pass('sin emisor: bloqueado')

  if (estadoPreparacionAfip(homo) !== 'homologacion_sin_cert') fail('estado homo sin cert')
  else pass('estadoPreparacionAfip: homologacion_sin_cert')

  if (estadoPreparacionAfip(prodSinCert) !== 'produccion_sin_certificados') fail('estado prod sin cert')
  else pass('estadoPreparacionAfip: produccion_sin_certificados')

  if (estadoPreparacionAfip(prodConCert) !== 'listo_produccion') fail('estado prod con cert')
  else pass('estadoPreparacionAfip: listo_produccion')

  const homoConCert = {
    ambiente: 'HOMOLOGACION' as const,
    certificadoPath: 'emisores/cert.crt',
    clavePrivadaPath: 'emisores/key.key',
  }
  if (estadoPreparacionAfip(homoConCert) !== 'listo_cambiar_a_produccion') fail('estado homo listo cambiar')
  else pass('estadoPreparacionAfip: listo_cambiar_a_produccion')

  const envOk = validarEnvProd({
    NODE_ENV: 'production',
    FORCE_PROD: '1',
    DATABASE_URL: 'postgresql://u:p@localhost/db',
    NEXTAUTH_SECRET: 'x'.repeat(32),
    NEXTAUTH_URL: 'https://erp.example.com',
    CRON_SECRET: 'y'.repeat(32),
    INTEGRATION_SECRET: 'z'.repeat(32),
    STORAGE_DRIVER: 's3',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_BUCKET: 'ibiomedica',
    S3_ACCESS_KEY_ID: 'admin',
    S3_SECRET_ACCESS_KEY: 'secret123456789',
    REDIS_URL: 'redis://127.0.0.1:6379',
  })
  if (envOk.errores > 0) fail(`env prod válido tiene ${envOk.errores} errores`)
  else pass('validarEnvProd: entorno mínimo prod OK')

  const envBad = validarEnvProd({ NODE_ENV: 'production', FORCE_PROD: '1' })
  if (envBad.errores === 0) fail('env prod vacío debe tener errores')
  else pass(`validarEnvProd: ${envBad.errores} errores en env vacío`)

  const alertasSinProd = validarAlertasEnvProd(process.env, { hayEmisorProduccion: false })
  if (alertasSinProd.length !== 0) fail('alertas sin prod no deben generar checks')
  else pass('validarAlertasEnvProd: sin prod → vacío')

  const alertasProd = validarAlertasEnvProd(
    { ADMIN_NOTIFY_EMAIL: 'admin@ib.com', SYSTEM_SMTP_HOST: 'smtp.test', SYSTEM_SMTP_USER: 'u' },
    { hayEmisorProduccion: true },
  )
  if (alertasProd.some((c) => c.nivel === 'warn' || c.nivel === 'error')) {
    fail('alertas prod completas no deben warn/error')
  } else pass('validarAlertasEnvProd: prod con email+SMTP OK')

  const alertasProdSinEmail = validarAlertasEnvProd({}, { hayEmisorProduccion: true })
  if (!alertasProdSinEmail.some((c) => c.nivel === 'warn' && c.msg.includes('ADMIN_NOTIFY_EMAIL'))) {
    fail('prod sin ADMIN_NOTIFY_EMAIL debe warn')
  } else pass('validarAlertasEnvProd: prod sin email → warn')

  if (!adminNotifyEmailDefinido({ ADMIN_NOTIFY_EMAIL: 'a@b.com' })) fail('adminNotifyEmailDefinido')
  else pass('adminNotifyEmailDefinido: true con env')

  if (smtpEnvConfigurado({ SYSTEM_SMTP_HOST: 'h', SYSTEM_SMTP_USER: 'u' })) pass('smtpEnvConfigurado: true')
  else fail('smtpEnvConfigurado debe ser true')

  console.log('')
  if (errors.length) {
    console.error(`\n${errors.length} fallo(s)\n`)
    process.exit(1)
  }
  console.log('Todos los tests pasaron\n')
}

main()
