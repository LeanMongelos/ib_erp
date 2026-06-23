import { Header } from '@/components/layout/Header'
import { ReportesPanel } from '@/components/reportes/ReportesPanel'
import { requirePagePermissionAny } from '@/lib/page-guard'
import { REPORTES_ACCESS_PERMISSIONS } from '@/lib/page-permissions'

export default async function ReportesPage() {
  await requirePagePermissionAny(...REPORTES_ACCESS_PERMISSIONS)
  return (
    <>
      <Header title="Reportes" subtitle="Comercial · Financiero · Operativo" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <ReportesPanel />
      </div>
    </>
  )
}
