/**
 * Restaura los permisos de un rol de sistema a los definidos en lib/rbac.ts
 * Uso: npx tsx --env-file=.env scripts/reset-role-permisos.ts ADMINISTRACION
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ROLE_PERMISSIONS, WILDCARD } from '../lib/rbac'

const clave = process.argv[2]?.toUpperCase()
if (!clave) {
  console.error('Uso: npx tsx --env-file=.env scripts/reset-role-permisos.ts <ROL>')
  process.exit(1)
}

if (clave === 'SUPERADMIN') {
  console.error('SUPERADMIN no se puede resetear con este script.')
  process.exit(1)
}

const definidos = ROLE_PERMISSIONS[clave]
if (!definidos) {
  console.error(`Rol desconocido: ${clave}`)
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const rol = await prisma.rolRBAC.findUnique({
    where: { clave },
    include: { permisos: { include: { permiso: true } } },
  })
  if (!rol) {
    console.error(`Rol ${clave} no encontrado en la base de datos.`)
    process.exit(1)
  }

  const antes = rol.permisos.map((p) => p.permiso.clave).sort()
  const claves = definidos.includes(WILDCARD)
    ? (await prisma.permiso.findMany()).map((p) => p.clave)
    : definidos

  const permisosDb = await prisma.permiso.findMany({ where: { clave: { in: claves } } })
  if (permisosDb.length !== claves.length) {
    const faltantes = claves.filter((c) => !permisosDb.some((p) => p.clave === c))
    console.error('Permisos no encontrados en BD:', faltantes.join(', '))
    process.exit(1)
  }

  await prisma.$transaction([
    prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } }),
    prisma.rolPermiso.createMany({
      data: permisosDb.map((p) => ({ rolId: rol.id, permisoId: p.id })),
    }),
  ])

  const despues = claves.sort()
  console.log(`✅ Rol ${clave} restaurado (${despues.length} permisos)`)
  if (antes.length !== despues.length) {
    const quitados = antes.filter((p) => !despues.includes(p))
    const agregados = despues.filter((p) => !antes.includes(p))
    if (quitados.length) console.log('  Quitados:', quitados.join(', '))
    if (agregados.length) console.log('  Agregados:', agregados.join(', '))
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
