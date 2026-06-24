/**
 * Sincroniza permisos de cartera de cheques en BD (post-deploy, idempotente).
 */
import { prisma } from '../lib/prisma'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../lib/rbac'

const CLAVES = ['cobranzas.cheques.read', 'cobranzas.cheques.manage'] as const
const ROLES = ['GERENTE', 'ADMINISTRACION', 'CONTABILIDAD', 'FACTURACION'] as const
const ROLES_EMISORES_CREATE = ['GERENTE', 'CONTABILIDAD'] as const

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

  const pEmisor = PERMISSIONS.find((x) => x.clave === 'emisores.create')
  if (pEmisor) {
    await prisma.permiso.upsert({
      where: { clave: pEmisor.clave },
      update: { modulo: pEmisor.modulo, descripcion: pEmisor.descripcion },
      create: pEmisor,
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

  if (pEmisor) {
    const permisoEmisor = await prisma.permiso.findUnique({ where: { clave: 'emisores.create' } })
    if (permisoEmisor) {
      for (const rolClave of ROLES_EMISORES_CREATE) {
        const rol = await prisma.rolRBAC.findUnique({ where: { clave: rolClave } })
        if (!rol) continue
        await prisma.rolPermiso.upsert({
          where: { rolId_permisoId: { rolId: rol.id, permisoId: permisoEmisor.id } },
          update: {},
          create: { rolId: rol.id, permisoId: permisoEmisor.id },
        })
      }
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
