import { Header } from '@/components/layout/Header'
import { CrmSubNav } from '@/components/crm/CrmSubNav'
import { InboxPanel } from '@/components/crm/InboxPanel'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/page-guard'
import { getSessionUser } from '@/lib/api-auth'
import { plain } from '@/lib/serialize'

export default async function CrmInboxPage() {
  await requirePagePermission('crm.read')
  const user = await getSessionUser()

  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  return (
    <>
      <Header title="CRM · Bandeja omnicanal" subtitle="WhatsApp · Instagram · Facebook · Email" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <CrmSubNav />
        <InboxPanel
          usuarios={JSON.parse(JSON.stringify(plain(usuarios)))}
          currentUserId={user?.id ?? null}
        />
      </div>
    </>
  )
}
