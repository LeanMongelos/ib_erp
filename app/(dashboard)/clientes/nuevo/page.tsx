import { Header } from '@/components/layout/Header'
import { NuevoClienteForm } from '@/components/crm/NuevoClienteForm'
import { requirePagePermission } from '@/lib/page-guard'

export default async function NuevoClientePage() {
  await requirePagePermission('clientes.create')

  return (
    <>
      <Header title="Nuevo Cliente" subtitle="Alta de cliente" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <NuevoClienteForm />
      </div>
    </>
  )
}
