/**
 * Sincroniza permisos del módulo tickets en BD existente (sin re-seed completo).
 */
import { prisma } from '../lib/prisma'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../lib/rbac'

const CLAVES = [
  'tickets.read',
  'tickets.read_all',
  'tickets.create',
  'tickets.update',
  'tickets.assign',
  'tickets.close',
] as const

async function main() {
  const permisoIds = new Map<string, string>()

  for (const clave of CLAVES) {
    const p = PERMISSIONS.find((x) => x.clave === clave)
    if (!p) throw new Error(`${clave} no está en PERMISSIONS`)
    const row = await prisma.permiso.upsert({
      where: { clave: p.clave },
      update: { modulo: p.modulo, descripcion: p.descripcion },
      create: p,
    })
    permisoIds.set(clave, row.id)
  }

  for (const [rolClave, permisos] of Object.entries(ROLE_PERMISSIONS)) {
    const rol = await prisma.rolRBAC.findUnique({ where: { clave: rolClave } })
    if (!rol) continue
    for (const clave of CLAVES) {
      if (!permisos.includes(clave)) continue
      const permisoId = permisoIds.get(clave)!
      await prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: rol.id, permisoId } },
        update: {},
        create: { rolId: rol.id, permisoId },
      })
    }
  }

  console.log(`✅ ${CLAVES.length} permisos tickets sincronizados`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
