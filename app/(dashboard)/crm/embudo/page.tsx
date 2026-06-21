import { Header } from '@/components/layout/Header'
import { CrmSubNav } from '@/components/crm/CrmSubNav'
import { EmbudoKanbanApp } from '@/components/crm/embudo/EmbudoKanbanApp'
import { requirePagePermission } from '@/lib/page-guard'

export default async function CrmEmbudoPage() {
  await requirePagePermission('crm.read')

  return (
    <>
      <Header
        title="CRM · Embudo de ventas"
        subtitle="Pipeline comercial · Kanban"
      />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#f0f2f5] px-3 py-2">
        <CrmSubNav />
        <EmbudoKanbanApp />
      </div>
    </>
  )
}
