import { Header } from '@/components/layout/Header'
import { PlantillasManager } from '@/components/plantillas/PlantillasManager'
import { requirePagePermission } from '@/lib/page-guard'

export default async function PlantillasPage() {
  await requirePagePermission('config.manage_billing_templates')

  return (
    <>
      <Header title="Plantillas de impresión" subtitle="Diseño, numeración y vista previa de factura, presupuesto y remito" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <PlantillasManager puedeEditar />
      </div>
    </>
  )
}
