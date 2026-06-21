import { Header } from '@/components/layout/Header'
import { CatalogosManager } from '@/components/configuracion/CatalogosManager'
import { requirePagePermission } from '@/lib/page-guard'

export default async function CatalogosConfigPage() {
  await requirePagePermission('config.update')

  return (
    <>
      <Header title="Catálogos / Maestros" subtitle="Categorías, depósitos y condiciones de pago" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <CatalogosManager />
      </div>
    </>
  )
}
