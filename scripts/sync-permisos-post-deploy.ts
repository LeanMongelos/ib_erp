/**
 * Sincroniza permisos nuevos desde PERMISSIONS y los asigna a roles base (ROLE_PERMISSIONS).
 * Idempotente — no elimina permisos custom agregados desde la UI de roles.
 *
 * Uso post-deploy: npx tsx --env-file=.env scripts/sync-permisos-post-deploy.ts
 */
import { prisma } from '../lib/prisma'
import { PERMISSIONS, ROLE_PERMISSIONS, WILDCARD } from '../lib/rbac'

async function main() {
  for (const p of PERMISSIONS) {
    await prisma.permiso.upsert({
      where: { clave: p.clave },
      update: { modulo: p.modulo, descripcion: p.descripcion },
      create: p,
    })
  }

  let asignaciones = 0
  for (const [rolClave, permisos] of Object.entries(ROLE_PERMISSIONS)) {
    if (permisos.includes(WILDCARD)) continue
    const rol = await prisma.rolRBAC.findUnique({ where: { clave: rolClave } })
    if (!rol) continue

    for (const clave of permisos) {
      const permiso = await prisma.permiso.findUnique({ where: { clave } })
      if (!permiso) continue
      await prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
        update: {},
        create: { rolId: rol.id, permisoId: permiso.id },
      })
      asignaciones++
    }
  }

  console.log(`✅ ${PERMISSIONS.length} permiso(s) sincronizados; ${asignaciones} asignación(es) rol base verificadas`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
