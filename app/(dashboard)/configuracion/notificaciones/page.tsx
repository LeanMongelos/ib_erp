import { Header } from '@/components/layout/Header'
import { NotificacionesManager } from '@/components/configuracion/NotificacionesManager'
import { requirePagePermission } from '@/lib/page-guard'

export default async function NotificacionesConfigPage() {
  await requirePagePermission('config.update')

  return (
    <>
      <Header title="Notificaciones" subtitle="Plantillas y reglas de aviso del ERP" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <NotificacionesManager />
      </div>
    </>
  )
}
