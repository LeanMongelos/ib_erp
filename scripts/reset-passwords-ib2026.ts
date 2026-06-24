/**
 * Asigna contraseña ib2026 a todos los usuarios excepto Leandro Mongelos.
 * Idempotente: solo corre una vez salvo --force.
 *
 * Uso: npx tsx --env-file=.env scripts/reset-passwords-ib2026.ts --execute
 */
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

const PASSWORD = 'ib2026'
const MARCA = 'RESET_PASSWORDS_IB2026'
const EXCLUIR_EMAIL = 'admin@ibiomedica.com'

function esLeandro(u: { email: string; nombre: string }): boolean {
  return (
    u.email.toLowerCase() === EXCLUIR_EMAIL ||
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

async function main() {
  const execute = process.argv.includes('--execute')
  const force = process.argv.includes('--force')

  if (!execute) {
    console.log('[reset-passwords] Omitido (usá --execute para aplicar).')
    return
  }

  if (!force && (await yaSeEjecuto())) {
    console.log('[reset-passwords] Ya se ejecutó antes; omitiendo (usá --force para repetir).')
  } else {
    const hash = await bcrypt.hash(PASSWORD, 10)
    const todos = await prisma.usuario.findMany({ orderBy: { nombre: 'asc' } })
    const actualizar = todos.filter((u) => !esLeandro(u))

    for (const u of actualizar) {
      await prisma.usuario.update({
        where: { id: u.id },
        data: { password: hash, exigirCambioPassword: false },
      })
    }

    await prisma.systemLog.create({
      data: {
        nivel: 'INFO',
        origen: 'reset-passwords-ib2026',
        mensaje: `${MARCA}: ${actualizar.length} usuarios actualizados`,
        metadata: { excluidos: todos.filter(esLeandro).map((u) => u.email) },
      },
    })

    console.log(`[reset-passwords] Contraseña "${PASSWORD}" aplicada a ${actualizar.length} usuario(s).`)
    console.log(`[reset-passwords] Excluido(s): ${todos.filter(esLeandro).map((u) => u.email).join(', ') || '—'}`)
  }

  const listado = await prisma.usuario.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    include: { roles: { include: { rol: { select: { nombre: true, clave: true } } } } },
  })

  console.log('\n--- Usuarios activos (acceso al ERP) ---\n')
  for (const u of listado) {
    const roles = u.roles.map((r) => r.rol.nombre).join(', ')
    const clave = esLeandro(u) ? '(sin cambios — contraseña actual)' : PASSWORD
    console.log(`${u.nombre}`)
    console.log(`  Email: ${u.email}`)
    console.log(`  Contraseña: ${clave}`)
    console.log(`  Roles: ${roles || '—'}`)
    console.log('')
  }
}

main()
  .catch((e) => {
    console.error('[reset-passwords] ERROR:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
