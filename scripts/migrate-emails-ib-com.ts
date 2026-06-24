/**
 * Migra emails @ibiomedica.com → @ib.com e invalida todas las sesiones activas.
 *
 * Orden (sensible):
 * 1. Incrementa sesionEpoch → todos los JWT vigentes dejan de ser válidos
 * 2. Renombra emails en la tabla usuarios
 * 3. Lista usuarios activos con credenciales
 *
 * Uso: npx tsx --env-file=.env scripts/migrate-emails-ib-com.ts --execute
 */
import { prisma } from '../lib/prisma'
import { invalidarCachePolitica } from '../lib/config/politica-seguridad'

const MARCA = 'MIGRATE_EMAILS_IB_COM'
const DOMINIO_VIEJO = '@ibiomedica.com'
const DOMINIO_NUEVO = '@ib.com'
const ADMIN_NUEVO = 'admin@ib.com'
const PASSWORD_EQUIPO = 'ib2026'

function esLeandro(u: { email: string; nombre: string }): boolean {
  const email = u.email.toLowerCase()
  return (
    email === ADMIN_NUEVO ||
    email === `admin${DOMINIO_VIEJO}` ||
    u.nombre.toLowerCase().includes('leandro mongelos')
  )
}

async function yaSeEjecuto(): Promise<boolean> {
  const prev = await prisma.systemLog.findFirst({
    where: { mensaje: { contains: MARCA } },
    select: { id: true },
  })
  return Boolean(prev)
}

async function invalidarTodasLasSesiones(): Promise<number> {
  const politica = await prisma.politicaSeguridad.upsert({
    where: { id: 'default' },
    update: { sesionEpoch: { increment: 1 } },
    create: { id: 'default', sesionEpoch: 2 },
  })
  invalidarCachePolitica()
  return politica.sesionEpoch
}

async function migrarEmails(): Promise<{ de: string; a: string }[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { email: { endsWith: DOMINIO_VIEJO } },
    orderBy: { nombre: 'asc' },
  })

  const cambios: { de: string; a: string }[] = []

  for (const u of usuarios) {
    const nuevo = u.email.replace(DOMINIO_VIEJO, DOMINIO_NUEVO)
    const existe = await prisma.usuario.findUnique({ where: { email: nuevo } })
    if (existe && existe.id !== u.id) {
      throw new Error(`Conflicto: ${nuevo} ya existe (usuario ${existe.nombre})`)
    }
    await prisma.usuario.update({
      where: { id: u.id },
      data: { email: nuevo },
    })
    cambios.push({ de: u.email, a: nuevo })
  }

  return cambios
}

async function limpiarLocksLoginRedis(): Promise<void> {
  const url = process.env.REDIS_URL
  if (!url) return
  try {
    const { default: Redis } = await import('ioredis')
    const redis = new Redis(url, { maxRetriesPerRequest: 1 })
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'login:*', 'COUNT', 200)
      cursor = next
      if (keys.length > 0) await redis.del(...keys)
    } while (cursor !== '0')
    redis.disconnect()
    console.log('[migrate-emails] Locks de login en Redis eliminados.')
  } catch (err) {
    console.warn('[migrate-emails] No se pudo limpiar Redis:', err)
  }
}

async function listarUsuariosActivos() {
  const listado = await prisma.usuario.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    include: { roles: { include: { rol: { select: { nombre: true } } } } },
  })

  console.log('\n--- Usuarios activos (acceso al ERP) ---\n')
  for (const u of listado) {
    const roles = u.roles.map((r) => r.rol.nombre).join(', ')
    const clave = esLeandro(u) ? '(sin cambios — contraseña actual)' : PASSWORD_EQUIPO
    console.log(`${u.nombre}`)
    console.log(`  Email: ${u.email}`)
    console.log(`  Contraseña: ${clave}`)
    console.log(`  Roles: ${roles || '—'}`)
    console.log('')
  }
}

async function main() {
  const execute = process.argv.includes('--execute')
  const force = process.argv.includes('--force')

  if (!execute) {
    console.log('[migrate-emails] Dry-run. Usá --execute para aplicar.')
    const pendientes = await prisma.usuario.count({
      where: { email: { endsWith: DOMINIO_VIEJO } },
    })
    console.log(`[migrate-emails] Usuarios con ${DOMINIO_VIEJO}: ${pendientes}`)
    await listarUsuariosActivos()
    return
  }

  if (!force && (await yaSeEjecuto())) {
    console.log('[migrate-emails] Ya se ejecutó antes; omitiendo migración (usá --force).')
    await listarUsuariosActivos()
    return
  }

  console.log('[migrate-emails] Paso 1/3: invalidando todas las sesiones JWT...')
  const epoch = await invalidarTodasLasSesiones()
  console.log(`[migrate-emails] sesionEpoch = ${epoch} — todos deben volver a iniciar sesión.`)

  console.log('[migrate-emails] Paso 2/3: migrando emails...')
  const cambios = await migrarEmails()
  if (cambios.length === 0) {
    console.log(`[migrate-emails] No había emails con ${DOMINIO_VIEJO}.`)
  } else {
    for (const c of cambios) {
      console.log(`  ${c.de} → ${c.a}`)
    }
  }

  await limpiarLocksLoginRedis()

  await prisma.systemLog.create({
    data: {
      nivel: 'INFO',
      origen: 'migrate-emails-ib-com',
      mensaje: `${MARCA}: ${cambios.length} email(s), sesionEpoch=${epoch}`,
      metadata: { cambios, sesionEpoch: epoch },
    },
  })

  console.log('[migrate-emails] Paso 3/3: listado final')
  await listarUsuariosActivos()
}

main()
  .catch((e) => {
    console.error('[migrate-emails] ERROR:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
