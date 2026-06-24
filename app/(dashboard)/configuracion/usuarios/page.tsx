import { Header } from '@/components/layout/Header'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { UsuariosManager } from '@/components/configuracion/UsuariosManager'
import { OnboardingChecklist } from '@/components/configuracion/OnboardingChecklist'
import { CapacitacionBanner } from '@/components/configuracion/CapacitacionBanner'

export default async function UsuariosPage() {
  await requirePagePermission('usuarios.read')

  const [usuariosRaw, roles] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true, nombre: true, email: true, telefono: true,
        activo: true, ultimoAcceso: true,
        roles: { select: { rol: { select: { clave: true, nombre: true } } } },
      },
    }),
    prisma.rolRBAC.findMany({ orderBy: { nombre: 'asc' }, select: { clave: true, nombre: true } }),
  ])

  const usuarios = usuariosRaw.map((u) => ({ ...u, roles: u.roles.map((r) => r.rol) }))

  return (
    <>
      <Header title="Usuarios y Roles" subtitle={`${usuarios.length} usuarios`} />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <OnboardingChecklist />
        <CapacitacionBanner />
        <UsuariosManager
          usuarios={JSON.parse(JSON.stringify(usuarios))}
          roles={roles}
        />
      </div>
    </>
  )
}
