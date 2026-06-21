import { Header } from '@/components/layout/Header'
import { ReportesPanel } from '@/components/reportes/ReportesPanel'

export default function ReportesPage() {
  return (
    <>
      <Header title="Reportes" subtitle="Comercial · Financiero · Operativo" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <ReportesPanel />
      </div>
    </>
  )
}
