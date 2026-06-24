/**
 * Sincroniza permisos de cartera de cheques en BD (post-deploy, idempotente).
 */
import { prisma } from '../lib/prisma'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../lib/rbac'

const CLAVES = ['cobranzas.cheques.read', 'cobranzas.cheques.manage'] as const
const ROLES = ['GERENTE', 'ADMINISTRACION', 'CONTABILIDAD', 'FACTURACION'] as const

async function main() {
  for (const clave of CLAVES) {
    const p = PERMISSIONS.find((x) => x.clave === clave)
    if (!p) throw new Error(`${clave} no está en PERMISSIONS`)
    await prisma.permiso.upsert({
      where: { clave: p.clave },
      update: { modulo: p.modulo, descripcion: p.descripcion },
      create: p,
    })
  }

  for (const rolClave of ROLES) {
    const rol = await prisma.rolRBAC.findUnique({ where: { clave: rolClave } })
    if (!rol) continue
    const esperados = ROLE_PERMISSIONS[rolClave] ?? []
    for (const clave of CLAVES) {
      if (!esperados.includes(clave)) continue
      const permiso = await prisma.permiso.findUnique({ where: { clave } })
      if (!permiso) continue
      await prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
        update: {},
        create: { rolId: rol.id, permisoId: permiso.id },
      })
    }
  }

  console.log('✅ permisos cheques sincronizados')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
