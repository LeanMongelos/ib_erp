import { Header } from '@/components/layout/Header'
import { LogsManager } from '@/components/configuracion/LogsManager'
import { requirePagePermission } from '@/lib/page-guard'

export default async function LogsConfigPage() {
  await requirePagePermission('logs.read')

  return (
    <>
      <Header title="Logs del sistema" subtitle="Errores técnicos y eventos de diagnóstico" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <LogsManager />
      </div>
    </>
  )
}
