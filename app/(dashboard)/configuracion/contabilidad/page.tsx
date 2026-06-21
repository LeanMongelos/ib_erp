import { Header } from '@/components/layout/Header'
import { ContabilidadHub } from '@/components/configuracion/ContabilidadHub'
import { requirePagePermission } from '@/lib/page-guard'
import { getResumenContabilidad } from '@/lib/contabilidad/seed-argentina'
import { plain } from '@/lib/serialize'
import type { ContabilidadResumen } from '@/lib/contabilidad/types'

export default async function ConfigContabilidadPage() {
  await requirePagePermission('config.manage_accounting')

  const resumen = await getResumenContabilidad()
  // Serialización explícita para props de Client Component (mismo patrón que emisores)
  const inicial = JSON.parse(JSON.stringify(plain(resumen))) as ContabilidadResumen

  const totalCatalogos =
    inicial.alicuotas.length +
    inicial.condicionesIva.length +
    inicial.comprobantesAfip.length +
    inicial.tiposDocumento.length +
    inicial.regimenes.length +
    inicial.planCuentas.length

  return (
    <>
      <Header
        title="Contabilidad y Fiscal"
        subtitle={`Ecosistema contable Argentina · ${totalCatalogos} ítems de catálogo`}
      />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <ContabilidadHub inicial={inicial} />
      </div>
    </>
  )
}
