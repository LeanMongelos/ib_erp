import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/api-auth'
import { PerfilForm } from '@/components/perfil/PerfilForm'

export default async function PerfilPage() {
  const actor = await getSessionUser()
  if (!actor) redirect('/login')

  const me = await prisma.usuario.findUnique({
    where: { id: actor.id },
    select: {
      id: true, nombre: true, email: true, telefono: true, avatarUrl: true,
      roles: { select: { rol: { select: { nombre: true } } } },
    },
  })
  if (!me) redirect('/login')

  return (
    <>
      <Header title="Mi perfil" subtitle="Editá tus datos y contraseña" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <PerfilForm
          me={JSON.parse(JSON.stringify({ ...me, roles: me.roles.map((r) => r.rol.nombre) }))}
        />
      </div>
    </>
  )
}
