import { Header } from '@/components/layout/Header'
import { IntegracionesPanel } from '@/components/integraciones/IntegracionesPanel'
import { requirePagePermission } from '@/lib/page-guard'

export default async function IntegracionesPage() {
  await requirePagePermission('config.manage_integrations')

  return (
    <>
      <Header title="Integraciones" subtitle="Conectá WhatsApp, redes sociales, correo y n8n" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <IntegracionesPanel />
      </div>
    </>
  )
}
