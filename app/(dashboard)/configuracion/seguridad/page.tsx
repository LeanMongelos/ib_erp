import { Header } from '@/components/layout/Header'
import { SeguridadManager } from '@/components/configuracion/SeguridadManager'
import { requirePagePermission } from '@/lib/page-guard'

export default async function SeguridadConfigPage() {
  await requirePagePermission('config.update')

  return (
    <>
      <Header title="Seguridad" subtitle="Contraseñas, bloqueos de acceso y sesiones" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <SeguridadManager />
      </div>
    </>
  )
}
