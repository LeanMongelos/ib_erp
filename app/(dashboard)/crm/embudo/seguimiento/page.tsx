import { Header } from '@/components/layout/Header'
import { CrmSubNav } from '@/components/crm/CrmSubNav'
import { EmbudoSubNav } from '@/components/crm/embudo/EmbudoSubNav'
import { EmbudoSeguimientoApp } from '@/components/crm/embudo/EmbudoSeguimientoApp'
import { requirePagePermission } from '@/lib/page-guard'

export default async function CrmEmbudoSeguimientoPage() {
  await requirePagePermission('crm.read')

  return (
    <>
      <Header
        title="CRM · Embudo de ventas"
        subtitle="Seguimiento de negocios"
      />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#f0f2f5] px-3 py-2">
        <CrmSubNav />
        <EmbudoSubNav />
        <EmbudoSeguimientoApp />
      </div>
    </>
  )
}
