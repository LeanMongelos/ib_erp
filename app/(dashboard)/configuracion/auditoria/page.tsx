import { Header } from '@/components/layout/Header'
import { AuditoriaManager } from '@/components/configuracion/AuditoriaManager'
import { requirePagePermission } from '@/lib/page-guard'

export default async function AuditoriaConfigPage() {
  await requirePagePermission('auditoria.read')

  return (
    <>
      <Header title="Auditoría" subtitle="Registro de cambios del sistema" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <AuditoriaManager />
      </div>
    </>
  )
}
