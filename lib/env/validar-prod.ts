/**
 * Validación de variables de entorno para producción (sin I/O de BD).
 */

export type EnvCheckNivel = 'ok' | 'warn' | 'error'

export type EnvCheck = { nivel: EnvCheckNivel; msg: string }

export type EnvValidacion = {
  checks: EnvCheck[]
  errores: number
  advertencias: number
}

function push(checks: EnvCheck[], nivel: EnvCheckNivel, msg: string) {
  checks.push({ nivel, msg })
}

function secretOk(val: string | undefined, minLen = 16): boolean {
  return Boolean(val?.trim() && val.trim().length >= minLen)
}

export function validarEnvProd(env: NodeJS.ProcessEnv = process.env): EnvValidacion {
  const checks: EnvCheck[] = []
  const isProd = env.NODE_ENV === 'production' || env.FORCE_PROD === '1'

  if (env.DATABASE_URL?.trim()) {
    push(checks, 'ok', 'DATABASE_URL definida')
  } else {
    push(checks, 'error', 'DATABASE_URL ausente')
  }

  if (secretOk(env.NEXTAUTH_SECRET)) {
    push(checks, 'ok', 'NEXTAUTH_SECRET definido')
  } else {
    push(checks, 'error', 'NEXTAUTH_SECRET ausente o demasiado corto (mín. 16 caracteres)')
  }

  const nextAuthUrl = env.NEXTAUTH_URL?.trim() ?? ''
  if (!nextAuthUrl) {
    push(checks, 'error', 'NEXTAUTH_URL ausente')
  } else   if (isProd && !nextAuthUrl.startsWith('https://')) {
    push(checks, 'error', 'NEXTAUTH_URL debe usar HTTPS en producción')
  } else {
    push(checks, 'ok', `NEXTAUTH_URL=${nextAuthUrl}`)
  }

  const appUrl = env.APP_URL?.trim() ?? ''
  if (isProd) {
    if (!appUrl) {
      push(checks, 'warn', 'APP_URL ausente — anti-CSRF Origin desactivado en mutaciones API')
    } else if (!appUrl.startsWith('https://')) {
      push(checks, 'error', 'APP_URL debe usar HTTPS en producción')
    } else if (appUrl !== nextAuthUrl && nextAuthUrl) {
      push(checks, 'warn', 'APP_URL difiere de NEXTAUTH_URL — deben coincidir')
    } else {
      push(checks, 'ok', `APP_URL=${appUrl}`)
    }
  }

  if (secretOk(env.CRON_SECRET)) {
    push(checks, 'ok', 'CRON_SECRET definido')
  } else {
    push(checks, 'error', 'CRON_SECRET ausente o demasiado corto — cron HTTP inseguro')
  }

  if (secretOk(env.INTEGRATION_SECRET)) {
    push(checks, 'ok', 'INTEGRATION_SECRET definido')
  } else {
    push(checks, 'error', 'INTEGRATION_SECRET ausente — cifrado de integraciones comprometido')
  }

  if (env.INTEGRATION_SECRET && env.NEXTAUTH_SECRET && env.INTEGRATION_SECRET === env.NEXTAUTH_SECRET) {
    push(checks, 'warn', 'INTEGRATION_SECRET igual a NEXTAUTH_SECRET — usar claves distintas')
  }

  const storageDriver = env.STORAGE_DRIVER ?? 'local'
  if (isProd) {
    if (storageDriver === 's3') {
      push(checks, 'ok', 'STORAGE_DRIVER=s3')
      for (const [key, label] of [
        ['S3_ENDPOINT', 'S3_ENDPOINT'],
        ['S3_BUCKET', 'S3_BUCKET'],
        ['S3_ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID'],
        ['S3_SECRET_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY'],
      ] as const) {
        if (env[key]?.trim()) push(checks, 'ok', `${label} definido`)
        else push(checks, 'error', `${label} ausente (requerido con STORAGE_DRIVER=s3)`)
      }
    } else {
      push(checks, 'error', 'STORAGE_DRIVER debe ser s3 en producción (certificados AFIP en MinIO/S3)')
    }
  } else if (storageDriver === 's3') {
    push(checks, 'ok', 'STORAGE_DRIVER=s3 (dev/staging)')
  }

  if (env.REDIS_URL?.trim()) {
    push(checks, 'ok', 'REDIS_URL definida')
  } else {
    push(checks, 'warn', 'REDIS_URL ausente — cola AFIP/cobranzas usará fallback síncrono')
  }

  if (isProd && !env.AFIP_ACCESS_TOKEN?.trim()) {
    push(checks, 'warn', 'AFIP_ACCESS_TOKEN ausente — verificar requisitos de @afipsdk/afip.js')
  } else if (env.AFIP_ACCESS_TOKEN?.trim()) {
    push(checks, 'ok', 'AFIP_ACCESS_TOKEN definido')
  }

  if (secretOk(env.N8N_API_KEY, 8)) {
    push(checks, 'ok', 'N8N_API_KEY definido')
  } else {
    push(checks, 'warn', 'N8N_API_KEY ausente — endpoints /api/n8n/* deshabilitados')
  }

  const errores = checks.filter((c) => c.nivel === 'error').length
  const advertencias = checks.filter((c) => c.nivel === 'warn').length
  return { checks, errores, advertencias }
}
