import { Header } from '@/components/layout/Header'
import { NuevoTicketForm } from '@/components/tickets/NuevoTicketForm'
import { requirePagePermission } from '@/lib/page-guard'
import { areaDesdeRol } from '@/lib/tickets/constants'

export default async function NuevoTicketPage() {
  const user = await requirePagePermission('tickets.create')
  const rolPrincipal = user.roles?.[0] ?? 'ADMINISTRACION'
  const areaOrigenDefault = areaDesdeRol(rolPrincipal)

  return (
    <>
      <Header title="Nueva solicitud" subtitle="Pedido de corrección, mejora o consulta sobre el ERP" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <NuevoTicketForm areaOrigenDefault={areaOrigenDefault} />
      </div>
    </>
  )
}
