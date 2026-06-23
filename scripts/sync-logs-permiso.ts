import { prisma } from '../lib/prisma'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../lib/rbac'

async function main() {
  const p = PERMISSIONS.find((x) => x.clave === 'logs.read')
  if (!p) throw new Error('logs.read no está en PERMISSIONS')

  await prisma.permiso.upsert({
    where: { clave: p.clave },
    update: { modulo: p.modulo, descripcion: p.descripcion },
    create: p,
  })

  const permiso = await prisma.permiso.findUnique({ where: { clave: 'logs.read' } })
  if (!permiso) throw new Error('permiso no creado')

  for (const rolClave of ['GERENTE']) {
    const rol = await prisma.rolRBAC.findUnique({ where: { clave: rolClave } })
    if (!rol) continue
    if (!ROLE_PERMISSIONS[rolClave]?.includes('logs.read')) continue
    await prisma.rolPermiso.upsert({
      where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
      update: {},
      create: { rolId: rol.id, permisoId: permiso.id },
    })
  }

  console.log('✅ permiso logs.read sincronizado')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
